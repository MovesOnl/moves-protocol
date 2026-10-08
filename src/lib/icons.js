// Official marks. X mark and GitHub Octicon (mark-github-24, MIT).
export const X_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>';

export const GITHUB_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 1C5.923 1 1 5.923 1 12c0 4.867 3.149 8.979 7.521 10.436.55.096.756-.233.756-.522 0-.262-.013-1.128-.013-2.049-2.764.509-3.479-.674-3.699-1.292-.124-.317-.66-1.293-1.127-1.554-.385-.207-.936-.715-.014-.729.866-.014 1.485.797 1.691 1.128.99 1.663 2.571 1.196 3.204.907.096-.715.385-1.196.701-1.471-2.448-.275-5.005-1.224-5.005-5.43 0-1.196.426-2.186 1.128-2.956-.111-.275-.496-1.402.11-2.915 0 0 .921-.288 3.024 1.128a10.193 10.193 0 0 1 2.75-.371c.936 0 1.871.123 2.75.371 2.104-1.43 3.025-1.128 3.025-1.128.605 1.513.221 2.64.111 2.915.701.77 1.127 1.747 1.127 2.956 0 4.222-2.571 5.155-5.019 5.43.399.344.743 1.004.743 2.035 0 1.471-.014 2.654-.014 3.025 0 .289.206.632.756.522C19.851 20.979 23 16.854 23 12c0-6.077-4.922-11-11-11Z"/></svg>';

export const COPY_ICON =
  '<svg class="ca-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="5.5" y="5.5" width="8" height="8" rx="2"/><path d="M10.5 3.5v-.5a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3v5A1.5 1.5 0 0 0 4 9.5h.5"/></svg>';

// Own line icons for the sample cards. Stroke draw-in is CSS driven.
const ICON_OPEN = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
export const CARD_ICONS = {
  wallets: ICON_OPEN + '<path class="draw" pathLength="1" d="M3 8.5A2.5 2.5 0 0 1 5.5 6H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 16.5Z"/><path class="draw" pathLength="1" d="M16 13h2.5"/><path class="draw" pathLength="1" d="M5.5 6 15 3.5"/></g></svg>',
  post: ICON_OPEN + '<path class="draw" pathLength="1" d="M4 5h16v11H11l-4.5 4v-4H4Z"/><path class="draw" pathLength="1" d="M8 9.5h8M8 12.5h5"/></g></svg>',
  launch: ICON_OPEN + '<path class="draw" pathLength="1" d="M5 19c0-6 4-12 14-14 0 10-6 14-12 14Z"/><path class="draw" pathLength="1" d="M9 15l-3 3"/><path class="draw" pathLength="1" d="M14.5 9.5h.01"/></g></svg>',
  shout: ICON_OPEN + '<path class="draw" pathLength="1" d="M4 10v4h3l7 4V6L7 10Z"/><path class="draw" pathLength="1" d="M17.5 9.5a4 4 0 0 1 0 5"/></g></svg>',
};

