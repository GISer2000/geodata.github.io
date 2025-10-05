// 定义数据类型和对应的JSON文件路径
const dataTypes = [
    { type: '微博数据', file: 'data/describe/weibo.json', image: 'fig/weibo.png' },
    { type: 'POI数据', file: 'data/describe/poi.json', image: 'fig/poi.png' },
    { type: 'AOI数据', file: 'data/describe/aoi.json', image: 'fig/aoi.png' },
    { type: '轨迹数据', file: 'data/describe/trajectory.json', image: 'fig/trajectory.png' },
    { type: 'OD数据', file: 'data/describe/od.json', image: 'fig/od.png' },
    { type: '建筑数据', file: 'data/describe/building.json', image: 'fig/building.png' },
    { type: '其他数据', file: 'data/describe/other.json', image: 'fig/other.png' }
];

// 定义数据类型描述字典
const dataTypeDescriptions = {
    '微博数据': '包含用户位置、时间戳、文本内容等信息，反映城市人群活动特征与热点分布。',
    'POI数据': '包含餐饮、购物、娱乐、教育等各类兴趣点信息，用于城市功能区识别与分析。',
    'AOI数据': '包含商圈、社区、公园等面状区域信息，用于城市空间结构分析与规划。',
    '轨迹数据': '包含出租车、共享单车等多源轨迹数据，反映城市人群移动模式与交通特征。',
    'OD数据': '包含城市区域间的人口流动数据，用于城市区域联系强度分析与区域协同发展研究。',
    '建筑数据': '包含城市建筑轮廓和高度信息，用于城市形态分析与三维城市建模。',
    '其他数据': '主要包含一些未分类数据，除了空间数据之外，还有一些没有位置信息的结构化数据。'
};

// 加载所有JSON文件并渲染卡片
async function loadAllDatasets() {
    const container = document.getElementById('datasets-container');
    
    try {
        // 加载所有JSON文件
        for (const dataType of dataTypes) {
            try {
                const response = await fetch(dataType.file);
                const data = await response.json();
                
                // 创建卡片
                const card = createDatasetCard(dataType, data);
                container.appendChild(card);
            } catch (error) {
                console.error(`加载 ${dataType.type} 数据失败:`, error);
            }
        }
        
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

// 创建数据集卡片
function createDatasetCard(dataType, data) {
    // 计算数据总大小
    const totalSize = calculateTotalSize(data);
    
    // 获取数据集个数
    const datasetCount = data.length;
    
    // 获取描述信息
    const description = dataTypeDescriptions[dataType.type] || '暂无描述信息';
    
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl shadow-md overflow-hidden card-hover';
    
    card.innerHTML = `
        <div class="h-48 overflow-hidden">
            <img src="${dataType.image}" alt="${dataType.type}" class="w-full h-full object-cover transition-transform duration-500 hover:scale-110">
        </div>
        <div class="p-6">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold">${getDisplayName(dataType.type)}</h3>
                <span class="bg-blue-100 text-blue-600 text-sm font-medium px-3 py-1 rounded-full">已上线</span>
            </div>
            <p class="text-gray-600 mb-4">${description}</p>
            <div class="flex items-center text-sm text-gray-500 mb-4">
                <span class="mr-4"><i class="fa-solid fa-database mr-1"></i> ${totalSize}</span>
                <span><i class="fa-solid fa-map-marker-alt mr-1"></i> ${datasetCount}个数据集</span>
            </div>
            <a href="#download" class="text-blue-600 hover:text-blue-800 font-medium flex items-center">
                查看详情 <i class="fa-solid fa-arrow-right ml-2"></i>
            </a>
        </div>
    `;
    
    return card;
}

// 计算总数据大小
function calculateTotalSize(data) {
    let totalMB = 0;
    
    data.forEach(item => {
        const sizeStr = item.size || '0MB';
        const sizeValue = parseFloat(sizeStr);
        const unit = sizeStr.replace(/[0-9.]/g, '').toUpperCase();
        
        if (unit.includes('GB')) {
            totalMB += sizeValue * 1024;
        } else if (unit.includes('MB')) {
            totalMB += sizeValue;
        } else if (unit.includes('KB')) {
            totalMB += sizeValue / 1024;
        }
    });
    
    if (totalMB >= 1024) {
        return `${(totalMB / 1024).toFixed(1)}GB+`;
    } else {
        return `${Math.ceil(totalMB)}MB+`;
    }
}

// 获取显示名称
function getDisplayName(type) {
    const nameMap = {
        '微博数据': '微博签到数据',
        'POI数据': '兴趣点(POI)数据',
        'AOI数据': '兴趣面(AOI)数据',
        '轨迹数据': '移动轨迹数据',
        'OD数据': 'OD流数据',
        '建筑数据': '建筑足迹数据',
        '其他数据': '其他门类数据'
    };
    
    return nameMap[type] || type;
}

// 页面加载完成后开始加载数据
document.addEventListener('DOMContentLoaded', loadAllDatasets);