export const globalState = {
    requestLog: [],
    config: null,
    apiConfig: null,
    captureRules: [], // 从后端获取的抓取规则
    requestStats: {
        total: 0,
        today: 0,
        lastResetDate: new Date().toDateString()
    }
}; 