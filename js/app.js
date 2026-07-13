// ============================================================================
// ALL4ONE COMMAND CENTER - MAIN APP LOGIC
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const loginView = document.getElementById('login-view');
    const appView = document.getElementById('app-view');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username-input');
    const logoutBtn = document.getElementById('logout-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const headerTitle = document.getElementById('header-title');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Titles Mapping ---
    const tabTitles = {
        'pdf-manager': 'PDF Document Manager',
        'dashboard': 'Trello Watcher',
        'casemaker': 'Case Maker'
    };

    // --- Dark Mode Initialization & Logic ---
    function initDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true' || 
                       (!('darkMode' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
        
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateDarkModeIcon();
    }

    function updateDarkModeIcon() {
        const isDark = document.documentElement.classList.contains('dark');
        // Lucide converts <i> to <svg>, so we replace the entire inner HTML to swap icons properly
        darkModeToggle.innerHTML = isDark 
            ? '<i data-lucide="sun" class="w-6 h-6"></i>' 
            : '<i data-lucide="moon" class="w-6 h-6"></i>';
        
        // Re-initialize only the new icon
        if (window.lucide) {
            lucide.createIcons();
        }
    }

    darkModeToggle.addEventListener('click', () => {
        const isCurrentlyDark = document.documentElement.classList.contains('dark');
        if (isCurrentlyDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('darkMode', 'false');
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('darkMode', 'true');
        }
        updateDarkModeIcon();
    });

    // --- Authentication State ---
    function checkAuth() {
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            // Hide login, show app
            loginView.classList.add('hidden');
            appView.classList.remove('hidden');
            appView.classList.add('flex'); 
            
            // Default to PDF manager tab upon login
            activateTab('pdf-manager');
        } else {
            // Hide app, show login
            loginView.classList.remove('hidden');
            appView.classList.add('hidden');
            appView.classList.remove('flex');
        }
    }

    // 1. Login Event
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = usernameInput.value.trim();
        if (name.length >= 2) {
            localStorage.setItem('currentUser', name);
            checkAuth();
        }
    });

    // 2. Logout Event
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('currentUser');
        usernameInput.value = '';
        checkAuth();
    });

    // --- Tab Switching Logic ---
    function activateTab(targetTabId) {
        // Hide all tab contents and reset button active states
        tabContents.forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('block');
        });
        
        tabButtons.forEach(btn => {
            // Reset to inactive state (Tailwind classes)
            btn.classList.remove('text-white', 'bg-slate-800');
            btn.classList.add('hover:text-white', 'hover:bg-slate-800/50');
            
            // Set active state
            if (btn.getAttribute('data-tab') === targetTabId) {
                btn.classList.remove('hover:text-white', 'hover:bg-slate-800/50');
                btn.classList.add('text-white', 'bg-slate-800');
            }
        });

        // Show the targeted content
        const targetContent = document.getElementById(`tab-${targetTabId}`);
        if (targetContent) {
            targetContent.classList.remove('hidden');
            targetContent.classList.add('block');
        }

        // Update Dynamic Header Title
        if (headerTitle && tabTitles[targetTabId]) {
            headerTitle.textContent = tabTitles[targetTabId];
        }
    }

    // Attach click listeners to all sidebar tab buttons
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            activateTab(targetTab);
        });
    });

    // --- Boot Sequence ---
    initDarkMode();
    checkAuth();
});