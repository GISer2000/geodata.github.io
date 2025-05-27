# GeoDataHub - 地理大数据下载平台

## 网页地址

数据下载中心：https://giser2000.github.io/geodata.github.io/

## 代码结构
```plaintext
geodata.github.io/
├── data/
│   ├── geodata/
│   │   ├── aoi/
│   │   ├── od/
│   │   ├── poi/
│   │   ├── trajectory/
│   │   └── weibo/
│   └── describe/
│       ├── aoi.json
│       ├── building.json
│       ├── od.json
│       ├── poi.json
│       ├── trajectory.json
│       └── weibo.json
├── fig/
│   ├── aoi.png
│   ├── building.png
│   ├── od.png
│   ├── poi.png
│   ├── trajectory.png
│   └── weibo.png
├── js/
│   ├── dynamic-renderer.js
│   └── map.js
├── README.md
└── index.html              
```

## 数据集信息
平台提供以下 6 大类地理数据集：
1. **微博签到数据**：包含用户位置、时间戳、文本内容等信息，反映城市人群活动特征与热点分布。
2. **兴趣点 (POI) 数据**：包含餐饮、购物、娱乐、教育等各类兴趣点信息，用于城市功能区识别与分析。
3. **兴趣面 (AOI) 数据**：包含商圈、社区、公园等面状区域信息，用于城市空间结构分析与规划。
4. **移动轨迹数据**：包含手机信令、共享单车等多源轨迹数据，反映城市人群移动模式与交通特征。
5. **OD 流数据**：包含城市间、区域间的人口流动数据，用于城市联系强度分析与区域协同发展研究。
6. **建筑足迹数据**：包含城市建筑轮廓和高度信息，用于城市形态分析与三维城市建模。

## 安装与使用

本项目为静态网页项目，无需复杂的安装过程。你可以按照以下步骤将项目文件克隆到本地：
```bash
git clone https://github.com/GISer2000/geodata.github.io.git
```

快速搭建一个本地的 HTTP 服务器，用于临时共享或测试文件：
```bash
python -m http.server 8000
```
访问 **http://localhost:8000** 会显示文件列表，点击下载好的项目 **geodata.github.io** 会渲染网页内容。

## 技术栈

- **前端框架**：Tailwind CSS，用于快速构建美观的用户界面。
- **图表库**：Chart.js，可用于数据可视化展示。
- **地图库**：OpenLayers，提供地图可视化功能。
