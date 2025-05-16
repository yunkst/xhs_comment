<template>
	<view class="content">
		<image class="logo" src="/static/logo.png"></image>
		<view class="text-area">
			<text class="title">{{title}}</text>
		</view>
		<button @click="jump">点击跳转</button>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				title: 'Hello'
			}
		},
		onLoad() {

		},
		methods: {
			jump(){
				xhs.openXhsDeeplink({
				  link: 'https://www.xiaohongshu.com/goods-detail/6466f7149ee737000134595a?xsec_token=XBXU8OCt0PkHIN5PBc-3FzVRrIIVMpMbl7BnXjd-bQMxU%3D&xsec_source=app_share&instation_link=xhsdiscover%3A%2F%2Fgoods_detail%2F6466f7149ee737000134595a%3Fgoods_detail_type%3DcurationGoods%26mode%3Dmini%26dsmatrix_key%3Ddistribution_RED_distributor_recommend_list%26source%3Ddistributor_recommend_list%26ds_token%3Dv3_62c507edc876bd7109a1688ba52d5229-5001%26trade_ext%3DeyJjaGFubmVsSW5mbyI6eyJjaGFubmVsIjoibGl2ZSIsImV4dHJhSW5mbyI6IntcImFuY2hvcklkXCI6XCI2NjYxNzc3OTAwMDAwMDAwMGQwMjQxMDBcIixcImFuY2hvck5hbWVcIjpcIjZhbXM1NzZLNTVxRU1UQXdNT1M0cXVhS3BPaUNwT1d3ajFScGNITT1cIixcImRpc3RyaWJ1dGlvblBsYW5JZFwiOlwiNjU1OWNjYTAzYWQ5ODcwMDAxNGMyMjU5XCIsXCJkc1Rva2VuXCI6XCJ2M182MmM1MDdlZGM4NzZiZDcxMDlhMTY4OGJhNTJkNTIyOS01MDAxXCIsXCJyZWFsQ29udHJhY3RJZFwiOlwiYmU0ZjA5NmM4ZjE2NGY0ODk5MDNjZTU4ZGZjZWYzMDZcIixcInNob3dQbGF5YmFja1wiOmZhbHNlLFwic3ViQ2hhbm5lbFwiOlwiQ1VSQVRJT05cIn0ifSwiZHNUb2tlbkluZm8iOnsiZHNUb2tlbiI6InYzXzYyYzUwN2VkYzg3NmJkNzEwOWExNjg4YmE1MmQ1MjI5LTUwMDEiLCJkc01hdHJpeCI6ImRpc3RyaWJ1dGlvbl9SRURfZGlzdHJpYnV0b3JfcmVjb21tZW5kX2xpc3QiLCJjb250cmFjdElkIjoiYmU0ZjA5NmM4ZjE2NGY0ODk5MDNjZTU4ZGZjZWYzMDYifSwic2hhcmVMaW5rIjoiaHR0cHM6Ly93d3cueGlhb2hvbmdzaHUuY29tL2dvb2RzLWRldGFpbC82NDY2ZjcxNDllZTczNzAwMDEzNDU5NWE%2FYXBwdWlkPTY2NjE3Nzc5MDAwMDAwMDAwZDAyNDEwMCIsImxpdmVJbmZvIjp7InN1YkNoYW5uZWwiOiJDVVJBVElPTiIsImRpc3RyaWJ1dGlvblBsYW5JZCI6IjY1NTljY2EwM2FkOTg3MDAwMTRjMjI1OSIsImFuY2hvcklkIjoiNjY2MTc3NzkwMDAwMDAwMDBkMDI0MTAwIiwicmVhbENvbnRyYWN0SWQiOiJiZTRmMDk2YzhmMTY0ZjQ4OTkwM2NlNThkZmNlZjMwNiIsIm5vdGVJZCI6bnVsbCwic2hvd1BsYXliYWNrIjpmYWxzZSwiYW5jaG9yTmFtZSI6IjZhbXM1NzZLNTVxRU1UQXdNT1M0cXVhS3BPaUNwT1d3ajFScGNITT0iLCJkc1Rva2VuIjoidjNfNjJjNTA3ZWRjODc2YmQ3MTA5YTE2ODhiYTUyZDUyMjktNTAwMSIsImRzbWF0cml4S2V5IjpudWxsLCJzb3VyY2UiOm51bGwsImNhcm91c2VsVGFyZ2V0IjpudWxsfSwic2hvcEluZm8iOm51bGwsImdvb2RzTm90ZUluZm8iOm51bGwsImNoYXRJbmZvIjpudWxsLCJzZWFyY2hJbmZvIjpudWxsLCJwcmVmZXIiOm51bGx9%26rn%3Dtrue&xhsshare=CopyLink&appuid=66617779000000000d024100&apptime=1746785003&share_id=1c6016249dda4309ba765e8ccfe38e7b&share_channel=copy_link', // 替换为实际的 Deeplink
				  success: (res) => {
				    console.log('跳转成功:', res.errMsg);
				  },
				  fail: (err) => {
				    console.error('跳转失败:', err.errMsg);
				  },
				  complete: () => {
				    console.log('openXhsDeeplink 调用结束');
				  }
				});
			}
		}
	}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.logo {
		height: 200rpx;
		width: 200rpx;
		margin-top: 200rpx;
		margin-left: auto;
		margin-right: auto;
		margin-bottom: 50rpx;
	}

	.text-area {
		display: flex;
		justify-content: center;
	}

	.title {
		font-size: 36rpx;
		color: #8f8f94;
	}
</style>
