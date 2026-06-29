// 집별 추출 화면 — 클릭 가능 프로토타입용 경량 상호작용 레이어.
// 정적 스냅샷이라 서버가 필요한 동작(검색·필터적용·저장)은 UI만 흉내냅니다.
(function () {
  var screen = document.body.dataset.screen || ''

  // 앱 라우트 → 추출 파일 매핑
  function mapPath(href) {
    var path = href.split('?')[0]
    var exact = {
      '/': '01-home.html',
      '/calendar': '04-calendar.html',
      '/news': '02-news.html',
      '/market-outlook': '03-market-outlook.html',
      '/settings': '11-settings.html',
      '/watch': '07-watch-region.html',
      '/transactions': '09-transactions.html',
      '/announcements': '05-announcements.html',
    }
    if (exact[path]) return exact[path]
    if (path.indexOf('/announcements/') === 0) return '06-announcement-detail.html'
    if (path.indexOf('/complex') === 0) return '10-complex-detail.html'
    return href
  }

  // 1) 내부 앵커 재작성 (하단 네비·카드·공고 링크 등)
  document.querySelectorAll('a[href^="/"]').forEach(function (a) {
    a.setAttribute('href', mapPath(a.getAttribute('href')))
  })

  function goBack() {
    if (history.length > 1) history.back()
    else location.href = '01-home.html'
  }

  // 2) 뒤로 버튼 (온보딩 제외)
  if (screen !== '00-onboarding') {
    document.querySelectorAll('button').forEach(function (b) {
      var t = b.textContent.trim()
      if (t === '‹' || t.indexOf('뒤로') !== -1) b.addEventListener('click', goBack)
    })
  }

  // 3) 관심지역/단지 탭 전환
  if (screen === '07-watch-region' || screen === '08-watch-complex') {
    document.querySelectorAll('button').forEach(function (b) {
      var t = b.textContent.trim()
      if (t === '지역') b.addEventListener('click', function () { location.href = '07-watch-region.html' })
      if (t === '단지') b.addEventListener('click', function () { location.href = '08-watch-complex.html' })
    })
  }

  // 4) 관심단지 카드 → 단지 상세
  if (screen === '08-watch-complex') {
    document.querySelectorAll('li button').forEach(function (b) {
      if (b.textContent.indexOf('›') !== -1) {
        b.addEventListener('click', function () { location.href = '10-complex-detail.html' })
      }
    })
  }

  // 5) 실거래: 필터 시트 / 상세 시트 토글
  if (screen === '09-transactions') {
    var closeSheet = function () {
      var e = document.getElementById('__sheet')
      if (e) e.remove()
    }
    var openSheet = function (html) {
      if (!html) return
      closeSheet()
      var w = document.createElement('div')
      w.id = '__sheet'
      w.innerHTML = html
      var ov = w.firstElementChild
      document.body.appendChild(w)
      if (ov) {
        ov.addEventListener('click', function (e) { if (e.target === ov) closeSheet() })
      }
      w.querySelectorAll('button').forEach(function (x) {
        var t = x.textContent.trim()
        if (t === '닫기' || t === '적용') x.addEventListener('click', closeSheet)
        if (t.indexOf('시세 추이') !== -1) x.addEventListener('click', function () { location.href = '10-complex-detail.html' })
      })
    }
    var filterHost = document.getElementById('tpl-tx-filter')
    var detailHost = document.getElementById('tpl-tx-detail')
    var filterHtml = filterHost ? filterHost.innerHTML : null
    var detailHtml = detailHost ? detailHost.innerHTML : null
    document.querySelectorAll('button').forEach(function (b) {
      if (b.textContent.indexOf('필터') !== -1) b.addEventListener('click', function () { openSheet(filterHtml) })
    })
    document.querySelectorAll('ul li button').forEach(function (b) {
      b.addEventListener('click', function () { openSheet(detailHtml) })
    })
  }

  // 6) 온보딩 스텝 진행
  if (screen === '00-onboarding') {
    var store = [].map.call(document.querySelectorAll('#onb-store > div'), function (d) { return d.innerHTML })
    var step = 0
    var enable = function () {
      document.querySelectorAll('#root button[disabled]').forEach(function (b) { b.removeAttribute('disabled') })
    }
    var render = function () {
      var root = document.getElementById('root')
      if (store[step]) root.innerHTML = store[step]
      enable()
    }
    enable()
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button')
      if (!b) return
      var t = b.textContent.trim()
      if (t === '다음') { step = Math.min(3, step + 1); render() }
      else if (t === '집별 시작하기') { location.href = '01-home.html' }
      else if (t === '‹') { step = Math.max(0, step - 1); render() }
    })
  }
})()
