// ============================================================================
// ALL4ONE COMMAND CENTER - MAIN APP LOGIC
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- GUARDIAN: FIREBASE INITIALIZATION ---
    // ⚠️ ACTION REQUIRED: Replace the apiKey and appId with your actual Firebase Project Settings
    const firebaseConfig = {
        apiKey: "AIzaSyD6RMjL3S2fSWRwzwWMYjeg53Hdh0GbtA4", 
        authDomain: "all4one-nexus.firebaseapp.com",
        projectId: "all4one-nexus",
        storageBucket: "all4one-nexus.firebasestorage.app",
        messagingSenderId: "1092267743610",
        appId: "1:1092267743610:web:f0c6370afcab7cbd559ec3"
    };
    
    // Initialize Firebase only if it hasn't been already
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    async function ensureFirebaseAuth() {
        try {
            if (!firebase.auth().currentUser) {
                await firebase.auth().signInAnonymously();
                console.log("GUARDIAN: Silent Firebase Authentication successful.");
            }
            return firebase.auth().currentUser;
        } catch (error) {
            console.error("GUARDIAN: Firebase Auth Failed. Did you enable Anonymous Auth in the Firebase Console?", error);
            return null;
        }
    }

    // Expose a global function to get the Firebase ID Token for other modules (like pdf-manager.js)
    // Retries anonymous sign-in if the session was lost, instead of silently returning null.
    window.getGuardianAuthToken = async () => {
        let user = firebase.auth().currentUser;
        if (!user) {
            user = await ensureFirebaseAuth();
        }
        if (!user) return null;
        return await user.getIdToken(true);
    };
    // --- END GUARDIAN INJECTION ---

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
        const icon = document.getElementById('dark-mode-icon');
        if (document.documentElement.classList.contains('dark')) {
            icon.setAttribute('data-lucide', 'sun');
        } else {
            icon.setAttribute('data-lucide', 'moon');
        }
        if (window.lucide) lucide.createIcons();
    }

    darkModeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('darkMode', isDark);
        updateDarkModeIcon();
    });

    // --- Auth / Login Logic ---
    async function checkLoginState() {
        const savedUser = localStorage.getItem('username');
        if (savedUser) {
            showApp();
            ensureFirebaseAuth();
        } else {
            showLogin();
        }
    }

    function showApp() {
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        // Default tab
        activateTab('pdf-manager');
    }

    function showLogin() {
        loginView.classList.remove('hidden');
        appView.classList.add('hidden');
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = usernameInput.value.trim();
        if (name.length > 2) {
            localStorage.setItem('username', name);
            showApp();
            ensureFirebaseAuth();
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to lock the workspace?")) {
            localStorage.removeItem('username');
            usernameInput.value = '';
            
            // Sign out of Firebase to destroy the token
            try {
                await firebase.auth().signOut();
            } catch (err) {
                console.error("Firebase signout error", err);
            }

            showLogin();
        }
    });

    // --- Tab Navigation Logic ---
    function activateTab(targetTabId) {
        // Hide all contents and reset button active states
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

    // --- Initialization ---
    initDarkMode();
    checkLoginState();

    if ('serviceWorker' in navigator) {
        const registerSw = (path) => navigator.serviceWorker.register(path);
        registerSw('./sw.js').catch(() => registerSw('public/sw.js').catch((err) => {
            console.warn('Service worker registration skipped:', err);
        }));
    }
});