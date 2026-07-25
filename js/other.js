// ============================================
// 导航管理 - 滚动效果 + 移动端菜单
// 功能：页面导航交互
// ============================================

(function() {
    'use strict';

    // ==================== 导航管理器 ====================
    class NavigationManager {
        constructor() {
            this.navbar = document.getElementById('navbar');
            this.menuBtn = document.getElementById('menuBtn');
            this.mobileMenu = document.getElementById('mobileMenu');
            this.isMenuOpen = false;
            this.scrollThreshold = 50;
            this.isInitialized = false;
        }

        /**
         * 初始化
         */
        init() {
            if (this.isInitialized) return;
            if (!this.navbar) {
                console.warn('⚠️ 导航栏元素不存在');
                return;
            }

            this.bindScrollEvent();
            this.bindMenuEvents();
            this.bindSmoothScroll();
            this.setActiveNavItem();
            this.handleInitialState();

            this.isInitialized = true;
            console.log('🧭 导航管理器初始化完成');
        }

        /**
         * 处理初始状态
         */
        handleInitialState() {
            // 检查页面加载时是否在顶部
            const isAtTop = window.scrollY <= this.scrollThreshold;
            if (!isAtTop) {
                this.navbar.classList.add('bg-white', 'shadow-md');
                this.navbar.classList.remove('bg-transparent');
            }
        }

        /**
         * 绑定滚动事件
         */
        bindScrollEvent() {
            const handleScroll = () => {
                const shouldShowBg = window.scrollY > this.scrollThreshold;
                
                this.navbar.classList.toggle('bg-white', shouldShowBg);
                this.navbar.classList.toggle('shadow-md', shouldShowBg);
                this.navbar.classList.toggle('bg-transparent', !shouldShowBg);
            };

            window.addEventListener('scroll', handleScroll, { passive: true });
        }

        /**
         * 绑定菜单事件
         */
        bindMenuEvents() {
            if (!this.menuBtn || !this.mobileMenu) {
                console.warn('⚠️ 移动端菜单元素不存在');
                return;
            }

            // 点击菜单按钮
            this.menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleMenu();
            });

            // 点击外部关闭
            document.addEventListener('click', (e) => {
                if (this.isMenuOpen && 
                    !this.menuBtn.contains(e.target) && 
                    !this.mobileMenu.contains(e.target)) {
                    this.closeMenu();
                }
            });

            // ESC键关闭
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.isMenuOpen) {
                    this.closeMenu();
                }
            });

            // 窗口resize自动关闭
            window.addEventListener('resize', () => {
                if (window.innerWidth > 768 && this.isMenuOpen) {
                    this.closeMenu();
                }
            });
        }

        /**
         * 切换菜单
         */
        toggleMenu() {
            this.isMenuOpen = !this.isMenuOpen;
            this.mobileMenu.classList.toggle('hidden', !this.isMenuOpen);
            document.body.style.overflow = this.isMenuOpen ? 'hidden' : '';
            this.updateMenuIcon();
        }

        /**
         * 关闭菜单
         */
        closeMenu() {
            if (!this.isMenuOpen) return;
            
            this.isMenuOpen = false;
            this.mobileMenu.classList.add('hidden');
            document.body.style.overflow = '';
            this.updateMenuIcon();
        }

        /**
         * 更新菜单图标
         */
        updateMenuIcon() {
            if (!this.menuBtn) return;
            this.menuBtn.innerHTML = this.isMenuOpen
                ? '<i class="fa-solid fa-times text-xl"></i>'
                : '<i class="fa-solid fa-bars text-xl"></i>';
        }

        /**
         * 绑定平滑滚动
         */
        bindSmoothScroll() {
            const anchors = document.querySelectorAll('a[href^="#"]');
            
            if (anchors.length === 0) return;

            anchors.forEach(anchor => {
                anchor.addEventListener('click', (e) => {
                    const targetId = anchor.getAttribute('href');
                    if (!targetId || targetId === '#') return;

                    e.preventDefault();
                    
                    const target = document.querySelector(targetId);
                    if (!target) return;

                    // 计算偏移量（考虑导航栏高度）
                    const navHeight = this.navbar?.offsetHeight || 80;
                    const offsetTop = target.offsetTop - navHeight;

                    // 平滑滚动
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });

                    // 更新URL（不触发滚动）
                    history.pushState(null, null, targetId);

                    // 移动端关闭菜单
                    if (this.isMenuOpen) {
                        this.closeMenu();
                    }
                });
            });
        }

        /**
         * 设置当前导航项高亮
         */
        setActiveNavItem() {
            const navLinks = document.querySelectorAll('.nav-link');
            
            if (navLinks.length === 0) return;

            const updateActiveLink = () => {
                const scrollPosition = window.scrollY + 100;

                navLinks.forEach(link => {
                    link.classList.remove('active');
                    
                    const targetId = link.getAttribute('href');
                    if (!targetId || targetId === '#') return;

                    const target = document.querySelector(targetId);
                    if (!target) return;

                    const offsetTop = target.offsetTop;
                    const offsetBottom = offsetTop + target.offsetHeight;

                    if (scrollPosition >= offsetTop && scrollPosition < offsetBottom) {
                        link.classList.add('active');
                    }
                });
            };

            window.addEventListener('scroll', updateActiveLink, { passive: true });
            // 立即执行一次
            setTimeout(updateActiveLink, 100);
        }

        /**
         * 销毁
         */
        destroy() {
            // 清理事件监听（这里简化处理，实际项目中需要更完善的清理）
            this.isMenuOpen = false;
            this.isInitialized = false;
            console.log('🗑️ 导航已销毁');
        }
    }

    // ==================== 启动 ====================
    const navigationManager = new NavigationManager();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => navigationManager.init());
    } else {
        navigationManager.init();
    }

    // 暴露API
    window.navigationManager = navigationManager;

})();