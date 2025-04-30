#!/usr/bin/env python3
from processing import parse_relative_timestamp
from datetime import datetime, timedelta

def test_timestamp_parser():
    """测试时间戳解析函数"""
    test_cases = [
        # 笔记发布时间示例
        "3 天前 浙江",
        "5 天前 北京",
        "1 天前 上海",
        
        # 其他常见格式
        "01-14",
        "昨天 14:09",
        "4天前",
        "2小时前",
        "30分钟前",
        "2023-01-10",
        "2023年1月10日",
        
        # 可能的异常情况
        "",
        None,
        "无效的格式",
        "昨天",
    ]
    
    print("====== 时间戳解析测试 ======")
    now = datetime.now()
    for case in test_cases:
        try:
            result = parse_relative_timestamp(case)
            if result:
                diff = now - result
                if case and "天前" in case and "浙江" in case:
                    print(f"√ 笔记格式 '{case}' => {result.isoformat()} (距现在约 {diff.days} 天)")
                else:
                    print(f"√ '{case}' => {result.isoformat()}")
            else:
                print(f"× '{case}' => 解析失败")
        except Exception as e:
            print(f"! '{case}' 发生异常: {e}")
    
    # 测试示例数据
    example = {
        'authorId': '65332bdd000000002b000ccd', 
        'fetchTimestamp': '2025-04-30T02:47:11.652Z', 
        'noteCommitCount': 14, 
        'noteContent': '杭州零跑C16价格，门店优惠直接干到了11000门店优惠，浙江省内有比我更优惠的吗？ #推荐有礼   #零跑汽车 #零跑C16 #新能源汽车', 
        'noteId': '680cea7b000000001d0271d3', 
        'noteLike': 0, 
        'publishTime': '3 天前 浙江', 
        'title': '成功提车啦！！！🚗零跑C16'
    }
    
    print("\n====== 笔记数据示例测试 ======")
    publish_time = parse_relative_timestamp(example['publishTime'])
    if publish_time:
        print(f"原始发布时间: {example['publishTime']}")
        print(f"解析后时间: {publish_time.isoformat()}")
        print(f"距今天数: {(datetime.now() - publish_time).days} 天")
    else:
        print(f"无法解析发布时间: {example['publishTime']}")

if __name__ == "__main__":
    test_timestamp_parser() 