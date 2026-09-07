// ============================================================================
// ALL4ONE COMMAND CENTER - MAIN APP LOGIC
// ============================================================================

import { registerReactTabs } from './react/mount.jsx';
import { getDefaultTab, initWorkspacePrefs, onWorkspaceTabActivated, expandSidebar } from './ui-prefs.js';
import { initCaseMakerThemeSync, loadCaseMakerFrameIfNeeded, postCaseMakerTheme } from './casemaker-theme.js';
import { isWorkspaceLocked, setWorkspaceLocked } from './workspace-identity.js';
import { applyFirstVisitPin, bindTabHistory, resolveIncomingTab, syncTabUrl } from './deep-links.js';
import { beginLazyTabLoad } from './workspace-loader.js';
import './pdf-manager.js';
import './trello.js';

registerReactTabs();

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
    
    // Gmail "Connect" uses Google signInWithPopup. In Firebase Console:
    // Authentication → Sign-in method → enable Google, and
    // Authentication → Settings → Authorized domains → add every host
    // (enock-elk.github.io — hostname only, no /All4One/docs path).
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
    const logoutBtn = document.getElementById('logout-btn');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const headerTitle = document.getElementById('header-title');
    
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // --- Titles Mapping ---
    const tabTitles = {
        'pdf-manager': 'Document Manager',
        'dashboard': 'Trello Watcher',
        'casemaker': 'Case Maker',
        'affidavits': 'Affidavit Automation',
        'emails': 'Draft Email Generator'
    };

    // --- Dark Mode Initialization & Logic ---
    function initDarkMode() {
        const isDark = localStorage.getItem('darkMode') === 'true';
        
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateDarkModeIcon();
    }

    function updateDarkModeIcon() {
        const icon = document.getElementById('dark-mode-icon');
        const label = document.getElementById('dark-mode-label');
        const isDark = document.documentElement.classList.contains('dark');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        }
        if (label) {
            label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
        if (window.lucide) lucide.createIcons();
    }

    darkModeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('darkMode', isDark);
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0f172a' : '#f8fafc');
        updateDarkModeIcon();
        postCaseMakerTheme();
    });

    // --- Workspace lock (no landing-name gate) ---
    const incomingTab = resolveIncomingTab();
    if (incomingTab) applyFirstVisitPin(incomingTab);

    function checkLoginState() {
        if (isWorkspaceLocked()) {
            showLock();
            return;
        }
        showApp();
        ensureFirebaseAuth();
    }

    function showApp() {
        setWorkspaceLocked(false);
        loginView.classList.add('hidden');
        appView.classList.remove('hidden');
        activateTab(incomingTab || getDefaultTab(), { replaceUrl: true });
    }

    function showLock() {
        loginView.classList.remove('hidden');
        appView.classList.add('hidden');
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        showApp();
        ensureFirebaseAuth();
    });

    logoutBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to lock the workspace?")) {
            setWorkspaceLocked(true);
            try {
                await firebase.auth().signOut();
            } catch (err) {
                console.error("Firebase signout error", err);
            }
            showLock();
        }
    });

    // --- Tab Navigation Logic ---
    function activateTab(targetTabId, { replaceUrl = false, skipHistory = false } = {}) {
        if (!tabTitles[targetTabId]) targetTabId = getDefaultTab();

        // Hide all contents and reset button active states
        tabContents.forEach(content => {
            content.classList.add('hidden');
            content.classList.remove('block');
        });
        
        tabButtons.forEach(btn => {
            const isActive = btn.getAttribute('data-tab') === targetTabId;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-current', isActive ? 'page' : 'false');
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

        if (targetTabId === 'casemaker' || targetTabId === 'affidavits' || targetTabId === 'emails') {
            beginLazyTabLoad(targetTabId, targetTabId === 'casemaker'
                ? 'Opening Case Maker…'
                : `Opening ${tabTitles[targetTabId]}…`);
        }

        // Notify React island modules to lazy-mount on first visit
        document.dispatchEvent(new CustomEvent('tab-activated', { detail: targetTabId }));
        onWorkspaceTabActivated(targetTabId);
        if (targetTabId === 'casemaker') {
            loadCaseMakerFrameIfNeeded();
            postCaseMakerTheme();
        }
        if (!skipHistory) syncTabUrl(targetTabId, { replace: replaceUrl });
    }

    // Attach click listeners to all sidebar tab buttons
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                expandSidebar();
                if (targetTab !== 'dashboard' && typeof window.exitTrelloWatcherFullscreen === 'function') {
                    window.exitTrelloWatcherFullscreen();
                }
                activateTab(targetTab);
            });
        });

    // Expose for modules that need tab switching
    window.activateWorkspaceTab = activateTab;
    bindTabHistory(activateTab);

    document.querySelector('[data-tab="casemaker"]')?.addEventListener('pointerenter', () => {
        loadCaseMakerFrameIfNeeded();
    }, { once: true });

    // --- Initialization ---
    initDarkMode();
    initCaseMakerThemeSync();
    initWorkspacePrefs();
    checkLoginState();

    if ('serviceWorker' in navigator) {
        const registerSw = (path) => navigator.serviceWorker.register(path);
        registerSw('./sw.js').catch(() => registerSw('public/sw.js').catch((err) => {
            console.warn('Service worker registration skipped:', err);
        }));
    }
});