"""Read-only browser QA for both themes. Requires local servers and Python Playwright.

All API writes are intercepted; no model calls or stored reports are created.
Run from frontend/: python3 scripts/check-theme-browser.py
"""
import json
import re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE = 'http://127.0.0.1:5173'
OUT = Path('.artifacts/theme')
OUT.mkdir(parents=True, exist_ok=True)
cache = {}
results = []
errors = []
writes = []
requests = []


def intercept(route):
    request = route.request
    requests.append((request.method, request.url))
    if request.method != 'GET':
        writes.append(request.url)
        if request.url.endswith('/summary'):
            route.fulfill(json={'report_id': request.url.split('/')[-2], 'text': '테마 검증용 요약입니다. 자료의 범위와 한계는 원본 보고서에서 확인합니다.', 'created_at': 'now', 'reused': True})
        else:
            route.fulfill(status=503, json={'detail': {'code': 'theme_qa_readonly', 'message': '테마 검증 중에는 저장·모델 호출을 실행하지 않습니다.'}})
        return
    key = request.url
    if key not in cache:
        response = route.fetch(timeout=60000)
        cache[key] = (response.status, response.headers.get('content-type', 'application/json'), response.body())
    status, content_type, body = cache[key]
    route.fulfill(status=status, content_type=content_type, body=body)


def observe(page):
    page.on('pageerror', lambda e: errors.append(str(e)))


def theme(page, mode):
    picker = page.get_by_role('combobox', name='화면 모드', exact=True)
    picker.select_option(mode)
    expect(page.locator('html')).to_have_attribute('data-theme', mode)
    expected = 'rgb(0, 0, 0)' if mode == 'dark' else 'rgb(245, 245, 247)'
    expect(page.locator('body')).to_have_css('background-color', expected)
    assert page.evaluate('getComputedStyle(document.documentElement).colorScheme') == mode
    assert page.locator('meta[name="theme-color"]').get_attribute('content') == ('#000000' if mode == 'dark' else '#f5f5f7')


def no_overflow(page):
    widths = page.evaluate('({scroll:document.documentElement.scrollWidth,viewport:innerWidth})')
    assert widths['scroll'] <= widths['viewport'] + 1, widths


def contrast_hex(a, b):
    def lum(s):
        channels = [int(s[i:i+2], 16)/255 for i in (1, 3, 5)]
        channels = [x/12.92 if x <= .04045 else ((x+.055)/1.055)**2.4 for x in channels]
        return sum(a*b for a, b in zip(channels, [.2126,.7152,.0722]))
    low, high = sorted([lum(a), lum(b)])
    return (high+.05)/(low+.05)


def composed_hex(fill, background):
    channels = [float(value) for value in re.findall(r'[\d.]+', fill)]
    alpha = channels[3] if len(channels) == 4 else 1
    base = [int(background[i:i+2],16) for i in [1,3,5]]
    return '#' + ''.join(f'{round(a*alpha+b*(1-alpha)):02x}' for a,b in zip(channels[:3],base))


with sync_playwright() as p:
    browser = p.chromium.launch(channel='chrome', headless=True)
    for width in [352, 390, 1360]:
        context = browser.new_context(color_scheme='light', viewport={'width': width, 'height': 950})
        context.route('**/api/**', intercept)
        page = context.new_page(); observe(page)
        for path in ['/', '/dashboard', '/welfare']:
            page.goto(BASE+path, wait_until='networkidle', timeout=90000)
            control = page.locator('textarea, input[type="text"]').first
            value = '테마 전환 입력 유지' if path == '/' else '강남'
            if control.count():
                control.fill(value)
                page.wait_for_timeout(400)
                page.wait_for_load_state('networkidle')
            for mode in ['light', 'dark']:
                before = len(requests)
                theme(page, mode)
                if control.count(): expect(control).to_have_value(value)
                page.wait_for_timeout(100)
                assert len(requests) == before, 'Theme switch triggered an API request'
                no_overflow(page)
                if width in [352,1360]:
                    page.screenshot(path=str(OUT/f'{path.strip("/") or "home"}-{mode}-{width}.png'), full_page=True)
                results.append({'page':path,'width':width,'theme':mode,'preserved_input':True,'no_overflow':True})
            print('page matrix:',width,path,flush=True)
        if width == 1360:
            for mode in ['light','dark']:
                theme(page,mode)
                tokens=page.evaluate('''() => Object.fromEntries(['canvas','elevated','field','fill','fill-strong','label','label-secondary','link','accent','accent-hover','on-accent'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue('--'+k).trim()]))''')
                for foreground in ['label','label-secondary','link']:
                    for background in ['canvas','elevated','field']:
                        ratio=contrast_hex(tokens[foreground],tokens[background])
                        assert ratio >= 4.5,(mode,foreground,background,ratio)
                assert contrast_hex(tokens['on-accent'],tokens['accent'])>=4.5
                assert contrast_hex(tokens['on-accent'],tokens['accent-hover'])>=4.5
                for surface in ['fill','fill-strong']:
                    for background in ['canvas','elevated']:
                        composed=composed_hex(tokens[surface],tokens[background])
                        assert contrast_hex(tokens['label-secondary'],composed)>=4.5,(mode,surface,background,composed)
                results.append({'contrast':mode,'normal_text_AA':True,'primary_hover_AA':True})
            theme(page,'dark')
            page.reload(wait_until='networkidle')
            expect(page.get_by_role('combobox',name='화면 모드')).to_have_value('dark')
            page.emulate_media(color_scheme='light')
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            page.get_by_role('combobox',name='화면 모드').select_option('system')
            expect(page.locator('html')).to_have_attribute('data-theme','light')
            page.emulate_media(color_scheme='dark')
            expect(page.locator('html')).to_have_attribute('data-theme','dark')
            peer=context.new_page();observe(peer);peer.goto(BASE,wait_until='networkidle')
            peer.get_by_role('button',name='저장된 보고서',exact=True).click()
            expect(peer.get_by_role('dialog')).to_be_visible()
            theme(page,'light')
            expect(peer.locator('html')).to_have_attribute('data-theme','light')
            expect(peer.get_by_role('dialog')).to_be_visible()
            expect(peer.get_by_role('heading',name='활동 변화 AI 요약')).to_be_visible()
            peer.screenshot(path=str(OUT/'reports-light.png'),full_page=True)
            theme(page,'dark');expect(peer.locator('html')).to_have_attribute('data-theme','dark')
            peer.screenshot(path=str(OUT/'reports-dark.png'),full_page=True)
            peer.get_by_role('tab',name='예방 대응',exact=True).click()
            expect(peer.get_by_text('서버에 저장됨',exact=True)).to_be_visible()
            peer.screenshot(path=str(OUT/'response-dark.png'),full_page=True)
            peer.get_by_role('button',name='닫기',exact=True).click()
            peer.get_by_role('button',name='대화 이력',exact=True).click()
            expect(peer.get_by_role('dialog')).to_be_visible()
            theme(page,'light');expect(peer.locator('html')).to_have_attribute('data-theme','light')
            peer.screenshot(path=str(OUT/'history-light.png'),full_page=True)
            peer.get_by_role('button',name='닫기',exact=True).click()
            peer.get_by_role('button',name='저장된 보고서',exact=True).click()
            peer.get_by_role('button',name='대응안 검토',exact=True).click()
            title=peer.get_by_role('textbox',name='대응안 이름')
            peer.wait_for_load_state('networkidle')
            if not title.count():
                peer.get_by_role('button',name='빈 대응안 추가',exact=True).click()
            expect(title).to_be_visible()
            title.fill('테마 전환 후에도 보존할 초안 · 저장하지 않음')
            for mode in ['light','dark']:
                before=len(writes)
                theme(page,mode);expect(peer.locator('html')).to_have_attribute('data-theme',mode)
                expect(title).to_have_value('테마 전환 후에도 보존할 초안 · 저장하지 않음')
                peer.screenshot(path=str(OUT/f'editor-{mode}.png'),full_page=True)
                assert len(writes)==before,'Theme switch in editor triggered API write'
            peer.close()
            picker=page.get_by_role('combobox',name='화면 모드')
            # macOS Chrome's native popup does not honor synthetic arrow keys
            # even on a plain select. Verify real tab focus/ring separately from
            # Playwright's native-option selection, without adding custom key handlers.
            page.bring_to_front()
            picker.focus();picker.press('Tab');page.keyboard.press('Shift+Tab')
            expect(picker).to_be_focused()
            assert picker.evaluate('(e)=>parseFloat(getComputedStyle(e).outlineWidth)')>=2
            picker.select_option('light')
            expect(picker).to_have_value('light')
            results.append({'persistence':True,'system_live_updates':True,'manual_override':True,'cross_tab_open_modal':True,'keyboard_focus_ring':True,'native_combobox_selection':True,'report_and_history':True,'editor_draft_preserved':True})
        context.close()
    # Confirm saved preferences are applied even when React never loads.
    context=browser.new_context(color_scheme='light')
    context.add_init_script("localStorage.setItem('hermes.theme','dark')")
    page=context.new_page();observe(page)
    blocked=[]
    def block_main(route):
        blocked.append(route.request.url)
        route.abort()
    page.route('**/src/main.tsx*',block_main)
    page.goto(BASE,wait_until='domcontentloaded')
    expect(page.locator('html')).to_have_attribute('data-theme','dark')
    assert blocked,'First-paint check must actually block the React entrypoint'
    assert page.locator('#root').inner_html()==''
    assert page.locator('meta[name="theme-color"]').get_attribute('content')=='#000000'
    context.close()
    # Storage errors must never prevent mounting or a manual override.
    context=browser.new_context(color_scheme='dark',viewport={'width':390,'height':844},reduced_motion='reduce')
    context.route('**/api/**',intercept)
    context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError')}})")
    page=context.new_page();observe(page);page.goto(BASE,wait_until='networkidle')
    expect(page.locator('html')).to_have_attribute('data-theme','dark')
    theme(page,'light');no_overflow(page)
    context.close()
    assert not errors, errors
    result={'matrix':results,'first_paint_before_react':True,'blocked_storage':True,'reduced_motion':True,'page_errors':errors,'api_writes_intercepted':len(writes)}
    (OUT/'verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print('THEME_BROWSER_CHECK_PASSED',json.dumps({'cases':len(results),'page_errors':errors,'writes_intercepted':len(writes)}),flush=True)
    browser.close()
