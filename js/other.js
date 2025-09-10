// 导航栏滚动效果
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('bg-white', 'shadow-md');
        navbar.classList.remove('bg-transparent');
    } else {
        navbar.classList.remove('bg-white', 'shadow-md');
        navbar.classList.add('bg-transparent');
    }
});

// 移动端菜单切换
const menuBtn = document.getElementById('menuBtn');
const mobileMenu = document.getElementById('mobileMenu');

menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    if (mobileMenu.classList.contains('hidden')) {
        menuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
    } else {
        menuBtn.innerHTML = '<i class="fa-solid fa-times text-xl"></i>';
    }
});

// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();

        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            window.scrollTo({
                top: targetElement.offsetTop - 80,
                behavior: 'smooth'
            });

            // 关闭移动端菜单
            if (!mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
                menuBtn.innerHTML = '<i class="fa-solid fa-bars text-xl"></i>';
            }
        }
    });
});

// 数据类型图表 (Chart.js)
if (document.getElementById('dataTypeChart')) {
    new Chart(document.getElementById('dataTypeChart'), {
        type: 'doughnut',
        data: {
            labels: ['微博数据', 'POI数据', 'AOI数据', '轨迹数据', 'OD数据', '建筑足迹数据'],
            datasets: [{
                data: [10, 12, 5, 7, 3, 4],
                backgroundColor: [
                    '#1E40AF',
                    '#3B82F6',
                    '#93C5FD',
                    '#F97316',
                    '#FB923C',
                    '#FDBA74'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15
                    }
                }
            }
        }
    });
}