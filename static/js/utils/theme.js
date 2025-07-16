export function initializeTheme() {
    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    
    // Update theme toggle icon
    updateThemeToggleIcon(savedTheme);
    
    // Make toggle function globally available
    window.toggleTheme = toggleTheme;
}

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    updateThemeToggleIcon(newTheme);
}

function updateThemeToggleIcon(theme) {
    const toggleIcon = document.querySelector('.theme-toggle i');
    if (toggleIcon) {
        toggleIcon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}
