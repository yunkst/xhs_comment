<template>
  <div class="notes-view">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>笔记管理</span>
        </div>
      </template>
      
      <!-- 搜索和过滤 -->
      <el-form :inline="true" :model="searchParams" class="demo-form-inline">
        <el-form-item label="笔记ID">
          <el-input v-model="searchParams.noteId" placeholder="输入笔记ID"></el-input>
        </el-form-item>
        <el-form-item label="作者名">
          <el-input v-model="searchParams.authorName" placeholder="输入作者昵称"></el-input>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="searchParams.keyword" placeholder="标题或内容关键词"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
        </el-form-item>
      </el-form>

      <!-- 笔记表格 -->
      <el-table :data="notes" stripe style="width: 100%" v-loading="loading">
        <el-table-column prop="noteId" label="笔记ID" width="220"></el-table-column>
        <el-table-column prop="title" label="标题" min-width="200">
            <template #default="{ row }">
                <el-link :href="'https://www.xiaohongshu.com/explore/' + row.noteId" type="primary" target="_blank">{{ row.title }}</el-link>
            </template>
        </el-table-column>
        <el-table-column prop="authorId" label="作者ID" width="180"></el-table-column>
        <el-table-column prop="publishTime" label="发布时间" width="180">
           <template #default="{ row }">
              {{ formatTime(row.publishTime) }}
            </template>
        </el-table-column>
        <el-table-column prop="noteLike" label="点赞数" width="100"></el-table-column>
        <el-table-column prop="noteCommitCount" label="评论数" width="100"></el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        style="margin-top: 20px;"
        background
        layout="prev, pager, next, total"
        :total="totalItems"
        :page-size="pageSize"
        @current-change="handlePageChange"
      >
      </el-pagination>

    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/services/api';

const notes = ref([]);
const loading = ref(false);
const totalItems = ref(0);
const currentPage = ref(1);
const pageSize = ref(10);

const searchParams = ref({
  noteId: '',
  authorName: '',
  keyword: ''
});

const fetchNotes = async () => {
  loading.value = true;
  try {
    const params = {
      ...searchParams.value,
      page: currentPage.value,
      page_size: pageSize.value
    };
    const response = await api.searchNotes(params);
    notes.value = response.data.items;
    totalItems.value = response.data.total;
  } catch (error) {
    ElMessage.error('获取笔记列表失败');
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  currentPage.value = 1;
  fetchNotes();
};

const handlePageChange = (page) => {
  currentPage.value = page;
  fetchNotes();
};

const formatTime = (isoTime) => {
  if (!isoTime) return 'N/A';
  return new Date(isoTime).toLocaleString();
};


onMounted(() => {
  fetchNotes();
});
</script>

<style scoped>
.notes-view {
  padding: 20px;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.demo-form-inline {
    margin-bottom: 20px;
}
</style> 