/**
 * dsh-image-drag — client half.
 *
 * Two small quality-of-life additions on top of the native right sidebar,
 * implemented without forking any shipped package:
 *
 * 1. Ctrl + left-button drag pans the open preview (image, PDF, Office→PDF,
 *    or anything drawn by the document preview's shared zoom viewport) by
 *    driving the preview's own scrollport — the same scrollLeft/scrollTop the
 *    scrollbars already own, so it composes with fit-width, fixed zoom and
 *    ctrl+wheel zoom instead of fighting them.
 *
 * 2. One close control per docked tab strip, so each side of a split right
 *    sidebar gets its own button. A click clears that pane's content and leaves
 *    the pane on its 开始 guide page: the pane, the split layout and the column
 *    all stay open, and the sibling pane is never touched. It prefers the
 *    public `ctx.sidebarRight` controller and falls back to clicking the native
 *    tab close controls when the controller is unavailable.
 *
 * Everything is additive: if the sidebar markup changes, each piece simply
 * does nothing. State is not persisted; there is no host half behaviour.
 */

window.__ModuleLoader__.load({
	id: 'dsh-image-drag',
	factory: (require) => {
		var module = { exports: {} }
		var exports = module.exports
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

		const PLUGIN_ID = 'dsh-image-drag'
		const STYLE_ID = PLUGIN_ID + '/styles-v1'
		const CLOSE_PANE_ATTR = 'data-dsh-rsp-close-pane'
		const TIP_ATTR = 'data-dsh-rsp-tip'
		const TOOLTIP_ATTR = 'data-dsh-rsp-tooltip'
		const PAN_THRESHOLD_PX = 4
		const PANEL_SELECTOR = '[data-sidebar-right-panel]'
		const SCROLLPORT_SELECTOR = '[data-document-zoom-scrollport]'
		const SIDEBAR_HOST_SELECTOR = '[data-sidebar-right-panel], [data-sidebar-right-session], [data-dockkit-float]'
		const CLOSE_ALL_LABEL = '关闭全部右侧边栏内容'
		const CLOSE_ALL_TIP = '关闭全部'
		const CLOSE_PANE_LABEL = '关闭本栏内容（保留开始页）'
		const CLOSE_PANE_TIP = '关闭本栏'
		const GUIDE_KIND = 'guide'

		let appCtx

		/* ------------------------------------------------------------------ *
		 * Styles
		 * ------------------------------------------------------------------ */

		const STYLES = `
html[data-dsh-rsp-ctrl] [data-document-zoom-scrollport] {
	cursor: grab;
}
html[data-dsh-rsp-panning],
html[data-dsh-rsp-panning] * {
	user-select: none !important;
	-webkit-user-select: none !important;
	cursor: grabbing !important;
}
button[${CLOSE_PANE_ATTR}] {
	position: relative;
}
[${TOOLTIP_ATTR}] {
	position: fixed;
	z-index: 2147483000;
	pointer-events: none;
	max-width: 240px;
	padding: 5px 9px;
	border-radius: 8px;
	background: rgba(36, 36, 38, 0.96);
	color: #fff;
	font-size: 12px;
	line-height: 18px;
	font-weight: 400;
	letter-spacing: 0;
	white-space: nowrap;
	box-shadow: 0 6px 18px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.12);
}
button[${CLOSE_PANE_ATTR}]:not([class]) {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 26px;
	height: 26px;
	padding: 0;
	border: 0;
	border-radius: 6px;
	background: transparent;
	color: inherit;
	cursor: pointer;
}
button[${CLOSE_PANE_ATTR}]:not([class]):hover {
	background: rgba(127, 127, 127, 0.14);
}
`

		function ensureStyles() {
			if (typeof document === 'undefined') return
			if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return
			const tag = document.createElement('style')
			tag.dataset.plugin = PLUGIN_ID
			tag.dataset.pluginCss = STYLE_ID
			tag.textContent = STYLES
			document.head.appendChild(tag)
		}

		/* ------------------------------------------------------------------ *
		 * Tooltip (fixed-position, so tab-strip overflow cannot clip it)
		 * ------------------------------------------------------------------ */

		let tooltip = null
		let tooltipTimer = null

		function hideTooltip() {
			if (tooltipTimer !== null) {
				clearTimeout(tooltipTimer)
				tooltipTimer = null
			}
			if (tooltip !== null) {
				tooltip.remove()
				tooltip = null
			}
		}

		function showTooltip(anchor) {
			hideTooltip()
			const text = anchor.getAttribute(TIP_ATTR)
			if (text === null || text === '') return
			tooltipTimer = setTimeout(() => {
				tooltipTimer = null
				if (!anchor.isConnected) return
				const node = document.createElement('div')
				node.setAttribute(TOOLTIP_ATTR, 'true')
				node.setAttribute('role', 'tooltip')
				node.textContent = text
				document.body.appendChild(node)
				const rect = anchor.getBoundingClientRect()
				const width = node.getBoundingClientRect().width
				const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
				node.style.left = Math.round(left) + 'px'
				node.style.top = Math.round(rect.bottom + 7) + 'px'
				tooltip = node
			}, 420)
		}

		/* ------------------------------------------------------------------ *
		 * Per-pane close buttons
		 * ------------------------------------------------------------------ */

		const CLOSE_PANE_ICON =
			'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" ' +
			'stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">' +
			'<rect x="1.7" y="5.5" width="8.4" height="8.4" rx="1.7"></rect>' +
			'<path d="M5 5.5V3.9c0-.72.58-1.3 1.3-1.3h6.4c.72 0 1.3.58 1.3 1.3v6.4c0 .72-.58 1.3-1.3 1.3h-1.6"></path>' +
			'<path d="M4.35 8.35L7.45 11.45M7.45 8.35L4.35 11.45"></path>' +
			'</svg>'

		function sidebarRightService() {
			if (appCtx === undefined || appCtx === null) return undefined
			try {
				const value = typeof appCtx.get === 'function' ? appCtx.get('sidebarRight') : undefined
				if (value !== undefined && value !== null) return value
			} catch (error) {
				/* service not mounted yet — fall back below */
			}
			try {
				return appCtx.sidebarRight
			} catch (error) {
				return undefined
			}
		}

		/** Committed tab records of one session; empty when the controller is absent. */
		function tabsOfSession(service, sessionId) {
			if (service === undefined || typeof sessionId !== 'string' || sessionId === '') return []
			try {
				if (typeof service.tabsIn === 'function') {
					const tabs = service.tabsIn(sessionId)
					return Array.isArray(tabs) ? tabs : []
				}
			} catch (error) {
				console.warn('[right-sidebar-toolkit] could not read open tabs', error)
			}
			return []
		}

		/** Close one tab of the panel's session through the narrowest public path. */
		function closeTab(service, sessionId, tabId) {
			if (service === undefined || typeof tabId !== 'string') return false
			try {
				if (typeof service.closeIn === 'function') {
					service.closeIn(sessionId, tabId)
					return true
				}
			} catch (error) {
				console.warn('[right-sidebar-toolkit] closeIn failed', error)
			}
			try {
				if (typeof service.close === 'function') {
					service.close(tabId)
					return true
				}
			} catch (error) {
				console.warn('[right-sidebar-toolkit] close failed', error)
			}
			return false
		}

		/** Docked panes of one panel; floating windows are separate surfaces. */
		function dockedPanes(panel) {
			return Array.from(panel.querySelectorAll('[data-dockkit-pane]')).filter((pane) => pane.closest('[data-dockkit-float]') === null)
		}

		/** Tab strips of the docked panes, one strip per pane. */
		function dockedStrips(panel) {
			return Array.from(panel.querySelectorAll('[data-dockkit-strip]')).filter((strip) => {
				return strip.closest('[data-dockkit-float]') === null && typeof strip.getAttribute('data-dockkit-strip') === 'string'
			})
		}

		function findPane(panel, paneId) {
			return Array.from(panel.querySelectorAll('[data-dockkit-pane]')).find((pane) => pane.getAttribute('data-dockkit-pane') === paneId) || null
		}

		function tabRecords(service, sessionId) {
			const records = new Map()
			for (const tab of tabsOfSession(service, sessionId)) {
				if (tab !== null && typeof tab === 'object' && typeof tab.id === 'string') records.set(tab.id, tab)
			}
			return records
		}

		function paneTabIds(pane) {
			return Array.from(pane.querySelectorAll('[data-dockkit-tab]'))
				.map((node) => node.getAttribute('data-dockkit-tab'))
				.filter((id) => typeof id === 'string' && id !== '')
		}

		function paneHasGuide(pane, records) {
			for (const tabId of paneTabIds(pane)) {
				const record = records.get(tabId)
				if (record !== undefined && record.kind === GUIDE_KIND) return true
			}
			return false
		}

		/** Open (or focus) the guide page inside one specific docked pane. */
		function openGuideInPane(service, paneId) {
			if (service === undefined || typeof service.openTab !== 'function' || typeof paneId !== 'string') return false
			try {
				service.openTab(GUIDE_KIND, { paneId, revealIfOpened: false })
				return true
			} catch (error) {
				console.warn('[right-sidebar-toolkit] could not open the guide tab', error)
				return false
			}
		}

		/**
		 * Clear one docked pane: close its non-guide tabs, leaving that pane on its
		 * own 开始 guide page. The pane's layout and its sibling pane are untouched.
		 *
		 * The guide is opened BEFORE the content closes so the pane never becomes
		 * empty mid-flight — an empty dock pane would be merged away by the kit, and
		 * closing the last docked tab of the column would collapse the whole column.
		 */
		function closePaneContent(panel, paneId) {
			const sessionId = panel.getAttribute('data-sidebar-right-session') || ''
			const pane = findPane(panel, paneId)
			const service = sidebarRightService()
			if (service !== undefined && typeof service.tabsIn === 'function') {
				return closePaneViaController(service, sessionId, pane)
			}
			return closePaneViaDom(panel, pane)
		}

		/** Controller path for one pane: keep that pane's guide, close its content. */
		function closePaneViaController(service, sessionId, pane) {
			if (pane === null || pane.closest('[data-dockkit-float]') !== null) return 0
			const paneId = pane.getAttribute('data-dockkit-pane')
			if (typeof paneId !== 'string' || paneId === '') return 0
			// 1. Guarantee this pane carries a guide tab before anything closes.
			if (!paneHasGuide(pane, tabRecords(service, sessionId))) openGuideInPane(service, paneId)
			// 2. Close only the non-guide tabs rendered by this pane.
			const records = tabRecords(service, sessionId)
			let closed = 0
			for (const tabId of paneTabIds(pane)) {
				const record = records.get(tabId)
				if (record === undefined || record.kind === GUIDE_KIND) continue
				if (closeTab(service, sessionId, tabId)) closed += 1
			}
			// 3. Repair a host that removed the guide or collapsed anyway.
			let expanded = true
			try {
				expanded = typeof service.isExpanded === 'function' ? service.isExpanded() : true
			} catch (error) {
				/* treat an unreadable state as expanded */
			}
			if (expanded === false && typeof service.toggleExpanded === 'function') {
				try {
					service.toggleExpanded()
				} catch (error) {
					console.warn('[right-sidebar-toolkit] could not reopen the column', error)
				}
			}
			return closed
		}

		/**
		 * DOM-only fallback for hosts without the sidebar controller: seed the
		 * pane's guide through its add control, then close tabs down to that one.
		 */
		function closePaneViaDom(panel, pane) {
			if (pane === null) return -1
			const add = pane.querySelector('[data-dockkit-add-tab]')
			if (add !== null) add.click()
			const deadline = Date.now() + 5000
			const step = () => {
				if (Date.now() > deadline) return
				const tabs = Array.from(pane.querySelectorAll('[data-dockkit-tab]'))
				if (tabs.length <= 1) {
					setTimeout(() => {
						if (panel.getAttribute('data-sidebar-right-open') !== null) return
						const expand = document.querySelector('[data-sidebar-right-expand]')
						if (expand instanceof HTMLElement) expand.click()
					}, 120)
					return
				}
				const close = tabs[tabs.length - 1].querySelector('[data-dockkit-tab-close]')
				if (close === null) return
				close.click()
				setTimeout(step, 40)
			}
			setTimeout(step, 80)
			return -1
		}

		function closePaneClick(event) {
			event.preventDefault()
			event.stopPropagation()
			hideTooltip()
			const button = event.currentTarget
			const panel = button.closest(PANEL_SELECTOR)
			const strip = button.closest('[data-dockkit-strip]')
			if (panel === null || strip === null) return
			const paneId = strip.getAttribute('data-dockkit-strip')
			if (typeof paneId !== 'string' || paneId === '') return
			try {
				closePaneContent(panel, paneId)
			} catch (error) {
				console.warn('[right-sidebar-toolkit] close-pane failed', error)
			}
		}

		/** Insertion point for the close control: just left of the kit's own controls. */
		function closeButtonAnchor(strip) {
			const split = strip.querySelector('[data-dockkit-split-button]')
			if (split !== null && split.parentElement !== null && split.parentElement.parentElement === strip) return split.parentElement
			const chrome = strip.querySelector('[data-dockkit-strip-chrome]')
			if (chrome !== null && chrome.parentElement === strip) return chrome
			return null
		}

		/** Inject (or refresh) the close control of one pane's tab strip. */
		function ensurePaneButton(panel, strip, paneCount) {
			if (!(panel instanceof Element) || !panel.isConnected) return
			const paneId = strip.getAttribute('data-dockkit-strip')
			if (typeof paneId !== 'string' || paneId === '') return
			let button = strip.querySelector('button[' + CLOSE_PANE_ATTR + ']')
			if (button === null) {
				button = document.createElement('button')
				button.type = 'button'
				button.setAttribute(CLOSE_PANE_ATTR, paneId)
				button.innerHTML = CLOSE_PANE_ICON
				// Copy an icon-button class only — never a tab's close X class, which
				// is sized/clipped for the chip row.
				const template =
					strip.querySelector('[data-dockkit-strip-chrome] button') ||
					strip.querySelector('button[data-dockkit-split-button]') ||
					strip.querySelector('button[data-dockkit-add-tab]')
				if (template !== null && template.classList.length > 0) button.className = template.className
				button.addEventListener('click', closePaneClick)
				button.addEventListener('mouseenter', () => showTooltip(button))
				button.addEventListener('mouseleave', hideTooltip)
				button.addEventListener('focus', () => showTooltip(button))
				button.addEventListener('blur', hideTooltip)
				strip.appendChild(button)
			}
			if (button.getAttribute(CLOSE_PANE_ATTR) !== paneId) button.setAttribute(CLOSE_PANE_ATTR, paneId)
			// With two panes each button clears only its own pane, so the labels say
			// what the click will do; a single pane keeps the "close all" wording.
			const split = paneCount > 1
			const label = split ? CLOSE_PANE_LABEL : CLOSE_ALL_LABEL
			const tip = split ? CLOSE_PANE_TIP : CLOSE_ALL_TIP
			if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label)
			if (button.getAttribute(TIP_ATTR) !== tip) button.setAttribute(TIP_ATTR, tip)
			// Sit immediately before the kit's trailing controls (split toggle, then
			// chrome). Appending after them would be clipped by the strip's overflow
			// on the chrome-less left pane, making the button unclickable.
			const anchor = closeButtonAnchor(strip)
			if (anchor !== null) {
				if (button.nextSibling !== anchor) strip.insertBefore(button, anchor)
			} else if (button !== strip.lastElementChild) {
				strip.appendChild(button)
			}
		}

		function syncPaneButtons() {
			for (const panel of document.querySelectorAll(PANEL_SELECTOR)) {
				const strips = dockedStrips(panel)
				const paneCount = dockedPanes(panel).length
				const paneIds = new Set()
				for (const strip of strips) {
					const paneId = strip.getAttribute('data-dockkit-strip')
					if (typeof paneId === 'string' && paneId !== '') paneIds.add(paneId)
					ensurePaneButton(panel, strip, paneCount)
				}
				for (const button of panel.querySelectorAll('button[' + CLOSE_PANE_ATTR + ']')) {
					if (!paneIds.has(button.getAttribute(CLOSE_PANE_ATTR))) button.remove()
				}
			}
		}

		function installCloseButtons(/* ctx */) {
			syncPaneButtons()
			let frame
			const schedule = () => {
				if (frame !== undefined) return
				frame = requestAnimationFrame(() => {
					frame = undefined
					syncPaneButtons()
				})
			}
			const observer = new MutationObserver(schedule)
			if (document.body !== null) observer.observe(document.body, { childList: true, subtree: true })
			// The observer misses nothing important, but a slow poll keeps the
			// control alive across React remounts that replace the whole strip.
			const poll = setInterval(syncPaneButtons, 1500)
			// Any interaction hides a lingering hover tooltip; without this a
			// tooltip can outlive the pointer leaving the strip (remounts swallow
			// the mouseleave).
			const dismissTooltip = () => hideTooltip()
			document.addEventListener('pointerdown', dismissTooltip, true)
			window.addEventListener('wheel', dismissTooltip, { capture: true, passive: true })
			return () => {
				observer.disconnect()
				clearInterval(poll)
				if (frame !== undefined) cancelAnimationFrame(frame)
				document.removeEventListener('pointerdown', dismissTooltip, true)
				window.removeEventListener('wheel', dismissTooltip, { capture: true })
				hideTooltip()
				for (const button of document.querySelectorAll('button[' + CLOSE_PANE_ATTR + ']')) button.remove()
			}
		}

		/* ------------------------------------------------------------------ *
		 * Ctrl + left-drag panning
		 * ------------------------------------------------------------------ */

		let drag = null
		let suppressClick = false
		let suppressClickTimer = null
		let suppressScrollport = null

		function isInteractiveTarget(target) {
			if (!(target instanceof Element)) return true
			return target.closest('a, button, input, textarea, select, [contenteditable="true"], [role="button"]') !== null
		}

		function isSidebarPreview(scrollport) {
			return scrollport.closest(SIDEBAR_HOST_SELECTOR) !== null
		}

		function clearSuppressClick() {
			suppressClick = false
			suppressScrollport = null
			if (suppressClickTimer !== null) {
				clearTimeout(suppressClickTimer)
				suppressClickTimer = null
			}
		}

		function suppressClickOnce(event) {
			if (!suppressClick) return
			const target = event.target
			// Only swallow the click that lands on the dragged surface itself; a
			// click anywhere else (another tab, panel chrome, …) stays usable even
			// right after a pan.
			if (!(target instanceof Element) || suppressScrollport === null || target.closest(SCROLLPORT_SELECTOR) !== suppressScrollport) {
				clearSuppressClick()
				return
			}
			event.preventDefault()
			event.stopPropagation()
			clearSuppressClick()
		}

		function removeDragListeners() {
			window.removeEventListener('pointermove', onPointerMove, true)
			window.removeEventListener('pointerup', onPointerUp, true)
			window.removeEventListener('pointercancel', onPointerUp, true)
			window.removeEventListener('blur', onDragWindowBlur, true)
			window.removeEventListener('click', suppressClickOnce, true)
		}

		function endDrag(wasEngaged) {
			const scrollport = drag === null ? null : drag.scrollport
			drag = null
			removeDragListeners()
			document.documentElement.removeAttribute('data-dsh-rsp-panning')
			if (wasEngaged && scrollport !== null) {
				// Swallow the click that trails a real pan so a drag that ends over a
				// PDF link or image cannot navigate by accident.
				suppressClick = true
				suppressScrollport = scrollport
				suppressClickTimer = setTimeout(clearSuppressClick, 320)
				window.addEventListener('click', suppressClickOnce, true)
			}
		}

		function onPointerDown(event) {
			if (drag !== null) endDrag(false)
			if (!event.ctrlKey || event.button !== 0) return
			if (event.pointerType !== undefined && event.pointerType !== 'mouse') return
			if (isInteractiveTarget(event.target)) return
			const scrollport = event.target instanceof Element ? event.target.closest(SCROLLPORT_SELECTOR) : null
			if (scrollport === null || !isSidebarPreview(scrollport)) return
			drag = {
				pointerId: event.pointerId,
				scrollport,
				startX: event.clientX,
				startY: event.clientY,
				scrollLeft: scrollport.scrollLeft,
				scrollTop: scrollport.scrollTop,
				engaged: false
			}
			window.addEventListener('pointermove', onPointerMove, true)
			window.addEventListener('pointerup', onPointerUp, true)
			window.addEventListener('pointercancel', onPointerUp, true)
			// Only a real window blur (alt-tab, app deactivation) aborts the gesture.
			// Element blur events are captured by this listener too, and a pointerdown
			// move the DOM focus — treating those as cancellation killed every drag.
			window.addEventListener('blur', onDragWindowBlur, true)
		}

		function onPointerMove(event) {
			if (drag === null || event.pointerId !== drag.pointerId) return
			const deltaX = event.clientX - drag.startX
			const deltaY = event.clientY - drag.startY
			if (!drag.engaged) {
				if (Math.abs(deltaX) < PAN_THRESHOLD_PX && Math.abs(deltaY) < PAN_THRESHOLD_PX) return
				drag.engaged = true
				document.documentElement.setAttribute('data-dsh-rsp-panning', '')
				window.addEventListener('click', suppressClickOnce, true)
			}
			event.preventDefault()
			drag.scrollport.scrollLeft = drag.scrollLeft - deltaX
			drag.scrollport.scrollTop = drag.scrollTop - deltaY
		}

		function onPointerUp(event) {
			if (drag === null) return
			if (event !== undefined && event.pointerId !== undefined && event.pointerId !== drag.pointerId) return
			const wasEngaged = drag.engaged
			endDrag(wasEngaged)
		}

		function onWindowBlur() {
			setCtrlAttribute(false)
		}

		/** Abort an active drag only when the whole window loses focus. */
		function onDragWindowBlur(event) {
			if (event !== undefined && event.target !== undefined && event.target !== window) return
			if (drag !== null) endDrag(drag.engaged)
		}

		function onDragStart(event) {
			if (!event.ctrlKey) return
			const target = event.target
			if (target instanceof Element && target.closest(SCROLLPORT_SELECTOR) !== null) event.preventDefault()
		}

		function setCtrlAttribute(on) {
			const root = document.documentElement
			if (on) root.setAttribute('data-dsh-rsp-ctrl', '')
			else root.removeAttribute('data-dsh-rsp-ctrl')
		}

		function onKeyDown(event) {
			if (event.key === 'Control') setCtrlAttribute(true)
		}

		function onKeyUp(event) {
			if (event.key === 'Control') setCtrlAttribute(false)
		}

		function installPan() {
			document.addEventListener('pointerdown', onPointerDown, true)
			document.addEventListener('dragstart', onDragStart, true)
			window.addEventListener('keydown', onKeyDown, true)
			window.addEventListener('keyup', onKeyUp, true)
			window.addEventListener('blur', onWindowBlur, true)
			return () => {
				document.removeEventListener('pointerdown', onPointerDown, true)
				document.removeEventListener('dragstart', onDragStart, true)
				window.removeEventListener('keydown', onKeyDown, true)
				window.removeEventListener('keyup', onKeyUp, true)
				window.removeEventListener('blur', onWindowBlur, true)
				removeDragListeners()
				drag = null
				clearSuppressClick()
				setCtrlAttribute(false)
				document.documentElement.removeAttribute('data-dsh-rsp-panning')
			}
		}

		/* ------------------------------------------------------------------ *
		 * Plugin
		 * ------------------------------------------------------------------ */

		function apply(ctx) {
			appCtx = ctx
			ensureStyles()
			ctx.effect(() => installPan(), 'right-sidebar-toolkit: ctrl+drag pan')
			ctx.effect(() => installCloseButtons(ctx), 'right-sidebar-toolkit: close-pane controls')
		}

		exports.name = PLUGIN_ID
		exports.inject = []
		exports.apply = apply
		return module.exports
	}
})
