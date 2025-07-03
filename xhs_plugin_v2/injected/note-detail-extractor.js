/**
 * 小红书笔记详情数据提取器
 * 从 window.__INITIAL_STATE__.note.noteDetailMap 获取完整的笔记信息
 */

// 笔记详情提取器类
class NoteDetailExtractor {
    constructor() {
        this.extractedNotes = new Map();
        this.isRunning = false;
        this.extractTimer = null;
        this.uploadQueue = [];
        this.isUploading = false;
        this.debugMode = false; // 默认关闭调试模式
    }

    /**
     * 调试日志
     */
    debug(message, data = null) {
        if (this.debugMode) {
            if (data) {
                console.log(`[NoteDetailExtractor] ${message}`, data);
            } else {
                console.log(`[NoteDetailExtractor] ${message}`);
            }
        }
    }

    /**
     * 开始监控和提取笔记详情数据
     */
    async start() {
        if (this.isRunning) {
            return;
        }

        this.debug('启动笔记详情数据提取器');
        this.isRunning = true;

        // 获取API配置
        await this.loadApiConfig();

        // 立即执行一次提取
        this.extractNoteDetails();

        // 设置定时器，每5秒检查一次
        this.extractTimer = setInterval(() => {
            this.extractNoteDetails();
        }, 5000);

        // 监听页面变化，实时提取
        this.observePageChanges();
    }

    /**
     * 停止提取器
     */
    stop() {
        this.debug('停止笔记详情数据提取器');
        this.isRunning = false;

        if (this.extractTimer) {
            clearInterval(this.extractTimer);
            this.extractTimer = null;
        }
    }

    /**
     * 监听页面变化
     */
    observePageChanges() {
        // 监听URL变化
        let currentUrl = window.location.href;
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                setTimeout(() => this.extractNoteDetails(), 1000);
            }
        };

        // 使用 MutationObserver 监听DOM变化
        const observer = new MutationObserver(() => {
            checkUrlChange();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        // 监听路由变化（针对单页应用）
        window.addEventListener('popstate', () => {
            setTimeout(() => this.extractNoteDetails(), 1000);
        });
    }

    /**
     * 提取笔记详情数据
     */
    extractNoteDetails() {
        try {            
            // 检查是否在小红书页面
            if (!window.location.hostname.includes('xiaohongshu.com')) {
                return;
            }

            // 检查 window.__INITIAL_STATE__ 是否存在
            if (typeof window.__INITIAL_STATE__ === 'undefined') {
                return;
            }

            // 检查 note 对象
            if (!window.__INITIAL_STATE__.note) {
                return;
            }

            // 获取 window.__INITIAL_STATE__.note.noteDetailMap
            const noteDetailMap = this.getNoteDetailMap();
            if (!noteDetailMap || typeof noteDetailMap !== 'object') {
                return;
            }

            const newNotes = [];
            const currentTime = Date.now();

            // 遍历所有笔记
            let processedCount = 0;
            let validCount = 0;
            let skipCount = 0;

            for (const [noteId, noteData] of Object.entries(noteDetailMap)) {
                processedCount++;

                if (!noteId || !noteData || typeof noteData !== 'object') {
                    continue;
                }

                // 检查笔记是否有效且包含note对象
                if (!noteData.note || typeof noteData.note !== 'object' || !noteData.note.noteId) {
                    continue;
                }

                validCount++;
                const note = noteData.note;
                const comments = noteData.comments || {};

                // 检查是否已经提取过这个笔记（避免重复）
                const lastExtracted = this.extractedNotes.get(noteId);
                if (lastExtracted && (currentTime - lastExtracted) < 60000) { // 1分钟内不重复提取
                    skipCount++;
                    continue;
                }

                // 构建完整的笔记详情数据
                const noteDetail = {
                    noteId: note.noteId,
                    type: note.type,
                    title: note.title,
                    desc: note.desc,
                    time: note.time,
                    lastUpdateTime: note.lastUpdateTime,
                    ipLocation: note.ipLocation,
                    xsecToken: note.xsecToken,
                    user: note.user,
                    interactInfo: note.interactInfo,
                    imageList: note.imageList || [],
                    video: this.processVideoData(note.video),
                    tagList: note.tagList || [],
                    atUserList: note.atUserList || [],
                    shareInfo: note.shareInfo,
                    comments: this.processComments(comments),
                    currentTime: noteData.currentTime,
                    extractTimestamp: currentTime
                };

                newNotes.push(noteDetail);
                this.extractedNotes.set(noteId, currentTime);
            }

            // 如果有新数据，加入上传队列
            if (newNotes.length > 0) {
                this.addToUploadQueue(newNotes);
                this.debug(`✨ 提取到 ${newNotes.length} 条新笔记详情`);
            }

        } catch (error) {
            console.error('[NoteDetailExtractor] 提取笔记详情时发生错误:', error);
            this.debug('提取错误详情:', {
                message: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * 加载API配置
     */
    async loadApiConfig() {
        try {
            return new Promise((resolve, reject) => {
                const requestId = Date.now();
                
                // 监听响应
                const responseHandler = (event) => {
                    const data = event.detail;
                    if (data && data.requestId === requestId) {
                        document.removeEventListener('XHS_CONFIG_RESPONSE', responseHandler);
                        
                        if (data.success && data.globalState) {
                            window.globalState = data.globalState;
                            resolve(window.globalState.apiConfig);
                        } else {
                            resolve(null);
                        }
                    }
                };
                
                document.addEventListener('XHS_CONFIG_RESPONSE', responseHandler);
                
                // 超时处理
                setTimeout(() => {
                    document.removeEventListener('XHS_CONFIG_RESPONSE', responseHandler);
                    resolve(null);
                }, 5000);
                
                // 通过postMessage与content script通信
                const event = new CustomEvent('XHS_GET_CONFIG', {
                    detail: { requestId: requestId }
                });
                document.dispatchEvent(event);
            });
            
        } catch (error) {
            console.error('[NoteDetailExtractor] 获取API配置失败:', error);
            return null;
        }
    }

    /**
     * 获取 noteDetailMap 数据
     */
    getNoteDetailMap() {
        try {
            if (window.__INITIAL_STATE__ && 
                window.__INITIAL_STATE__.note && 
                window.__INITIAL_STATE__.note.noteDetailMap) {
                return window.__INITIAL_STATE__.note.noteDetailMap;
            }
            
            return null;
        } catch (error) {
            console.error('[NoteDetailExtractor] 获取 noteDetailMap 失败:', error);
            return null;
        }
    }

    /**
     * 处理视频数据，转换为后端期望的格式
     */
    processVideoData(video) {
        if (!video || typeof video !== 'object') {
            return {
                videoId: null,
                duration: null,
                md5: null,
                streamTypes: [],
                h264: [],
                h265: [],
                h266: [],
                av1: [],
                firstFrameFileid: null,
                thumbnailFileid: null
            };
        }

        // 初始化标准格式
        const processedVideo = {
            videoId: null,
            duration: null,
            md5: null,
            streamTypes: [],
            h264: [],
            h265: [],
            h266: [],
            av1: [],
            firstFrameFileid: null,
            thumbnailFileid: null
        };

        try {
            // 从小红书原始结构中提取数据
            if (video.media) {
                // 提取 videoId
                if (video.media.videoId) {
                    processedVideo.videoId = video.media.videoId;
                }

                // 提取视频基本信息
                if (video.media.video) {
                    const videoInfo = video.media.video;
                    processedVideo.duration = videoInfo.duration || null;
                    processedVideo.md5 = videoInfo.md5 || null;
                    processedVideo.streamTypes = videoInfo.streamTypes || [];
                }

                // 提取视频流信息
                if (video.media.stream) {
                    const stream = video.media.stream;
                    
                    // 处理 H.264 流
                    if (stream.h264 && Array.isArray(stream.h264)) {
                        processedVideo.h264 = stream.h264.map(streamInfo => ({
                            duration: streamInfo.duration || streamInfo.videoDuration || null,
                            width: streamInfo.width || null,
                            height: streamInfo.height || null,
                            avgBitrate: streamInfo.avgBitrate || streamInfo.videoBitrate || null,
                            qualityType: streamInfo.qualityType || null,
                            size: streamInfo.size || null,
                            masterUrl: streamInfo.masterUrl || null,
                            backupUrls: streamInfo.backupUrls || [],
                            format: streamInfo.format || null,
                            videoCodec: streamInfo.videoCodec || null,
                            audioCodec: streamInfo.audioCodec || null,
                            fps: streamInfo.fps || null
                        }));
                    }

                    // 处理 H.265 流
                    if (stream.h265 && Array.isArray(stream.h265)) {
                        processedVideo.h265 = stream.h265.map(streamInfo => ({
                            duration: streamInfo.duration || streamInfo.videoDuration || null,
                            width: streamInfo.width || null,
                            height: streamInfo.height || null,
                            avgBitrate: streamInfo.avgBitrate || streamInfo.videoBitrate || null,
                            qualityType: streamInfo.qualityType || null,
                            size: streamInfo.size || null,
                            masterUrl: streamInfo.masterUrl || null,
                            backupUrls: streamInfo.backupUrls || [],
                            format: streamInfo.format || null,
                            videoCodec: streamInfo.videoCodec || null,
                            audioCodec: streamInfo.audioCodec || null,
                            fps: streamInfo.fps || null
                        }));
                    }

                    // 处理 H.266 流
                    if (stream.h266 && Array.isArray(stream.h266)) {
                        processedVideo.h266 = stream.h266.map(streamInfo => ({
                            duration: streamInfo.duration || streamInfo.videoDuration || null,
                            width: streamInfo.width || null,
                            height: streamInfo.height || null,
                            avgBitrate: streamInfo.avgBitrate || streamInfo.videoBitrate || null,
                            qualityType: streamInfo.qualityType || null,
                            size: streamInfo.size || null,
                            masterUrl: streamInfo.masterUrl || null,
                            backupUrls: streamInfo.backupUrls || [],
                            format: streamInfo.format || null,
                            videoCodec: streamInfo.videoCodec || null,
                            audioCodec: streamInfo.audioCodec || null,
                            fps: streamInfo.fps || null
                        }));
                    }

                    // 处理 AV1 流
                    if (stream.av1 && Array.isArray(stream.av1)) {
                        processedVideo.av1 = stream.av1.map(streamInfo => ({
                            duration: streamInfo.duration || streamInfo.videoDuration || null,
                            width: streamInfo.width || null,
                            height: streamInfo.height || null,
                            avgBitrate: streamInfo.avgBitrate || streamInfo.videoBitrate || null,
                            qualityType: streamInfo.qualityType || null,
                            size: streamInfo.size || null,
                            masterUrl: streamInfo.masterUrl || null,
                            backupUrls: streamInfo.backupUrls || [],
                            format: streamInfo.format || null,
                            videoCodec: streamInfo.videoCodec || null,
                            audioCodec: streamInfo.audioCodec || null,
                            fps: streamInfo.fps || null
                        }));
                    }
                }
            }

            // 从 capa 中提取时长（备用）
            if (!processedVideo.duration && video.capa && video.capa.duration) {
                processedVideo.duration = video.capa.duration;
            }

            // 提取缩略图信息
            if (video.image) {
                processedVideo.firstFrameFileid = video.image.firstFrameFileid || null;
                processedVideo.thumbnailFileid = video.image.thumbnailFileid || null;
            }

        } catch (error) {
            console.error('[NoteDetailExtractor] 处理视频数据时发生错误:', error);
        }

        return processedVideo;
    }

    /**
     * 处理评论数据，清理和标准化格式
     */
    processComments(comments) {
        if (!comments || typeof comments !== 'object') {
            return {
                list: [],
                cursor: '',
                hasMore: false,
                loading: false,
                firstRequestFinish: false
            };
        }

        const processedComments = {
            list: [],
            cursor: comments.cursor || '',
            hasMore: comments.hasMore || false,
            loading: comments.loading || false,
            firstRequestFinish: comments.firstRequestFinish || false
        };

        if (comments.list && Array.isArray(comments.list)) {
            processedComments.list = comments.list.map(comment => this.processComment(comment)).filter(Boolean);
        }

        return processedComments;
    }

    /**
     * 处理单条评论数据
     */
    processComment(comment) {
        if (!comment || typeof comment !== 'object') {
            return null;
        }

        const processedComment = {
            id: comment.id,
            content: comment.content,
            createTime: comment.createTime,
            likeCount: comment.likeCount || '0',
            liked: comment.liked || false,
            status: comment.status,
            ipLocation: comment.ipLocation,
            userInfo: comment.userInfo,
            showTags: comment.showTags || [],
            atUsers: comment.atUsers || [],
            pictures: comment.pictures || [],
            subCommentCount: comment.subCommentCount || '0',
            subComments: [],
            subCommentCursor: comment.subCommentCursor,
            subCommentHasMore: comment.subCommentHasMore || false,
            expended: comment.expended || false,
            hasMore: comment.hasMore || false
        };

        // 处理子评论
        if (comment.subComments && Array.isArray(comment.subComments)) {
            processedComment.subComments = comment.subComments.map(subComment => {
                if (!subComment || typeof subComment !== 'object') {
                    return null;
                }
                
                return {
                    id: subComment.id,
                    content: subComment.content,
                    createTime: subComment.createTime,
                    likeCount: subComment.likeCount || '0',
                    liked: subComment.liked || false,
                    status: subComment.status,
                    ipLocation: subComment.ipLocation,
                    userInfo: subComment.userInfo,
                    showTags: subComment.showTags || [],
                    atUsers: subComment.atUsers || [],
                    pictures: subComment.pictures || [],
                    targetComment: subComment.targetComment
                };
            }).filter(Boolean);
        }

        return processedComment;
    }

    /**
     * 添加到上传队列
     */
    addToUploadQueue(notes) {
        this.debug(`添加 ${notes.length} 条笔记到上传队列`);
        this.uploadQueue.push(...notes);
        
        // 如果没有正在上传，开始上传
        if (!this.isUploading) {
            this.processUploadQueue();
        }
    }

    /**
     * 处理上传队列
     */
    async processUploadQueue() {
        if (this.isUploading || this.uploadQueue.length === 0) {
            return;
        }

        this.isUploading = true;

        try {
            // 批量上传，每次最多10条
            const batchSize = 10;
            while (this.uploadQueue.length > 0) {
                const batch = this.uploadQueue.splice(0, batchSize);
                await this.uploadNoteDetails(batch);
                
                // 短暂延迟，避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error('[NoteDetailExtractor] 处理上传队列时发生错误:', error);
        } finally {
            this.isUploading = false;
        }
    }

    /**
     * 上传笔记详情数据到后台
     */
    async uploadNoteDetails(noteDetails) {
        try {
            const requestId = `note_details_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // 通过 content script 发送到后台
            const requestData = {
                requestId: requestId,
                url: '/api/v1/content/notes/details/upload',
                options: {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${window.globalState?.apiConfig?.token || ''}`
                    },
                    body: JSON.stringify(noteDetails)
                },
                timeout: 30000
            };

            const event = new CustomEvent('XHS_PROXY_REQUEST', {
                detail: requestData
            });

            // 监听响应
            return new Promise((resolve, reject) => {
                const responseHandler = (event) => {
                    if (!event.detail) {
                        return;
                    }

                    const response = event.detail;
                    
                    if (response.requestId === requestId) {
                        document.removeEventListener('XHS_PROXY_RESPONSE', responseHandler);
                        
                        if (response.success) {
                            this.debug('✅ 笔记详情数据上传成功');
                            resolve(response.data);
                        } else {
                            console.error('[NoteDetailExtractor] 笔记详情数据上传失败:', response.error);
                            reject(new Error(response.error || '上传失败'));
                        }
                    }
                };

                document.addEventListener('XHS_PROXY_RESPONSE', responseHandler);
                
                // 设置超时
                setTimeout(() => {
                    document.removeEventListener('XHS_PROXY_RESPONSE', responseHandler);
                    reject(new Error('上传请求超时'));
                }, 30000);

                // 发送请求
                document.dispatchEvent(event);
            });

        } catch (error) {
            console.error('[NoteDetailExtractor] 上传笔记详情数据时发生错误:', error);
            throw error;
        }
    }

    /**
     * 获取提取器状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            extractedCount: this.extractedNotes.size,
            queueLength: this.uploadQueue.length,
            isUploading: this.isUploading
        };
    }

    /**
     * 手动触发一次提取
     */
    manualExtract() {
        this.extractNoteDetails();
    }

    /**
     * 清除已提取的记录
     */
    clearExtractedCache() {
        this.extractedNotes.clear();
    }

    /**
     * 切换调试模式
     */
    toggleDebug() {
        this.debugMode = !this.debugMode;
        this.debug(`调试模式已${this.debugMode ? '开启' : '关闭'}`);
    }

    /**
     * 诊断当前页面状态
     */
    diagnose() {
        console.log('=== 笔记详情提取器诊断 ===');
        console.log('当前URL:', window.location.href);
        console.log('是否小红书页面:', window.location.hostname.includes('xiaohongshu.com'));
        console.log('__INITIAL_STATE__ 存在:', typeof window.__INITIAL_STATE__ !== 'undefined');
        
        if (window.__INITIAL_STATE__) {
            console.log('__INITIAL_STATE__ keys:', Object.keys(window.__INITIAL_STATE__));
            if (window.__INITIAL_STATE__.note) {
                console.log('note keys:', Object.keys(window.__INITIAL_STATE__.note));
                if (window.__INITIAL_STATE__.note.noteDetailMap) {
                    const noteDetailMap = window.__INITIAL_STATE__.note.noteDetailMap;
                    console.log('noteDetailMap 笔记数量:', Object.keys(noteDetailMap).length);
                    console.log('noteDetailMap keys (前5个):', Object.keys(noteDetailMap).slice(0, 5));
                    
                    // 显示第一个笔记的结构
                    const firstNoteId = Object.keys(noteDetailMap)[0];
                    if (firstNoteId) {
                        console.log('第一个笔记结构:', noteDetailMap[firstNoteId]);
                        
                        // 如果是视频笔记，显示视频数据转换
                        const note = noteDetailMap[firstNoteId].note;
                        if (note && note.type === 'video' && note.video) {
                            console.log('原始视频数据:', note.video);
                            console.log('转换后视频数据:', this.processVideoData(note.video));
                        }
                    }
                } else {
                    console.log('noteDetailMap 不存在');
                }
            } else {
                console.log('note 对象不存在');
            }
        }
        
        console.log('提取器状态:', this.getStatus());
        console.log('=== 诊断完成 ===');
    }
}

// 创建全局实例
window.noteDetailExtractor = new NoteDetailExtractor();

// 自动启动（如果在小红书页面）
if (window.location.hostname.includes('xiaohongshu.com')) {
    // 延迟启动，确保页面完全加载
    setTimeout(() => {
        window.noteDetailExtractor.start();
    }, 2000);
}

// 暴露调试接口
window.xhsNoteDetailExtractor = {
    start: () => window.noteDetailExtractor.start(),
    stop: () => window.noteDetailExtractor.stop(),
    extract: () => window.noteDetailExtractor.manualExtract(),
    status: () => window.noteDetailExtractor.getStatus(),
    clearCache: () => window.noteDetailExtractor.clearExtractedCache(),
    toggleDebug: () => window.noteDetailExtractor.toggleDebug(),
    diagnose: () => window.noteDetailExtractor.diagnose()
};

export { NoteDetailExtractor }; 