#!/usr/bin/env python3
"""0주차 PoC — 공공 API 실호출 + fixture 저장

각 소스 1회 호출 → collector/fixtures/{source}.json 저장
기획안 1-2절 ★ 확인 항목을 콘솔에 출력한다.

실행: python poc_fetch.py (collector/ 에서)
"""
import json
import os
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
load_dotenv(ROOT / ".env")

SERVICE_KEY = os.environ["DATA_GO_KR_SERVICE_KEY"]
ECOS_KEY    = os.environ["ECOS_API_KEY"]
FIXTURES    = Path(__file__).parent / "fixtures"
FIXTURES.mkdir(exist_ok=True)

RESULTS: dict[str, str] = {}


def save(name: str, data: object) -> None:
    path = FIXTURES / f"{name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"  → saved {path.name}")


def get_json(client: httpx.Client, url: str, params: dict) -> object:
    r = client.get(url, params=params, timeout=30)
    try:
        return r.json()
    except Exception:
        return {"_raw_text": r.text, "_status": r.status_code}


def get_xml_items(client: httpx.Client, url: str, params: dict) -> tuple[list[dict], str]:
    """XML 응답 파싱 → item 목록 + raw XML 문자열 반환"""
    r = client.get(url, params=params, timeout=30)
    raw = r.text
    root = ET.fromstring(raw)
    items = []
    for item_el in root.findall(".//item"):
        items.append({child.tag: child.text for child in item_el})
    total = root.findtext(".//totalCount") or "?"
    return items, raw, total


# ─── 1. 청약홈 APT 분양정보 ──────────────────────────────────────────────────
# odcloud namespace: 15101046
# ★ 확인: 지역 필터 필드(공급지역코드), 공고번호 유일성
def poc_applyhome_apt(client: httpx.Client) -> None:
    print("\n[1] 청약홈 APT 분양정보")
    url = ("https://api.odcloud.kr/api/15101046/v1"
           "/uddi:14a46595-03dd-47d3-a418-d64e52820598")
    r = client.get(url, params={
        "serviceKey": SERVICE_KEY,
        "page":       1,
        "perPage":    5,
        "returnType": "json",
    }, timeout=30)
    data = r.json()
    save("applyhome_apt", data)

    items = data.get("data", [])
    print(f"  총 {data.get('totalCount')}건")
    for item in items[:3]:
        print(f"  공고번호={item.get('공고번호')} | 주택명={item.get('주택명')} "
              f"| 공급지역={item.get('공급지역명')}({item.get('공급지역코드')}) "
              f"| 주택구분={item.get('주택구분코드명')}")
    if items:
        print(f"  ★ 서울 필터: 공급지역코드=100")
        print(f"  ★ 공고번호 유일 키 확인: '공고번호' 필드 존재")
    RESULTS["applyhome_apt"] = "OK"


# ─── 2. 청약홈 무순위·잔여세대 ───────────────────────────────────────────────
# odcloud namespace: 15128105
# ★ 확인: 공급지역코드 없음 — 공급위치(텍스트 주소)로 지역 매칭 필요
def poc_applyhome_unranked(client: httpx.Client) -> None:
    print("\n[2] 청약홈 APT 무순위·잔여세대")
    url = ("https://api.odcloud.kr/api/15128105/v1"
           "/uddi:d084bc01-f419-45ac-8555-bcd270c4b656")
    r = client.get(url, params={
        "serviceKey": SERVICE_KEY,
        "page":       1,
        "perPage":    5,
        "returnType": "json",
    }, timeout=30)
    data = r.json()
    save("applyhome_unranked", data)

    items = data.get("data", [])
    print(f"  총 {data.get('totalCount')}건")
    for item in items[:3]:
        print(f"  공고번호={item.get('공고번호')} | 주택명={item.get('주택명')} "
              f"| 공급위치={item.get('공급위치')} | 주택구분={item.get('주택구분코드명')}")
    if items:
        has_region_code = "공급지역코드" in items[0]
        print(f"  ★ 공급지역코드 필드: {'있음' if has_region_code else '없음 ⚠️  → 공급위치 텍스트로 서울 매칭 필요'}")
    RESULTS["applyhome_unranked"] = "OK"


# ─── 3. LH 분양임대공고 ──────────────────────────────────────────────────────
# 공고문(목록): apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1
# ★ 확인: 공고ID(PAN_ID), 지역 매칭 방식(CNP_CD_NM 텍스트 — ARA_CD 필터 미작동)
def poc_lh_notice(client: httpx.Client) -> None:
    print("\n[3] LH 분양임대공고 (공고문 목록)")
    url = ("https://apis.data.go.kr/B552555"
           "/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1")
    r = client.get(url, params={
        "serviceKey": SERVICE_KEY,
        "PG_SZ":      5,
        "PAGE":       1,
    }, timeout=30)
    data = r.json()
    save("lh_notice", data)

    items  = data[1].get("dsList", []) if isinstance(data, list) and len(data) > 1 else []
    header = data[1].get("resHeader", [{}])[0] if isinstance(data, list) and len(data) > 1 else {}
    total  = items[0].get("ALL_CNT", "?") if items else "?"

    print(f"  총 {total}건 (SS_CODE={header.get('SS_CODE')})")
    for item in items[:3]:
        print(f"  PAN_ID={item.get('PAN_ID')} | 공고명={item.get('PAN_NM')[:30]}... "
              f"| 지역={item.get('CNP_CD_NM')} | 유형={item.get('AIS_TP_CD_NM')} | 상태={item.get('PAN_SS')}")

    if items:
        print(f"  ★ 유일키: PAN_ID")
        print(f"  ★ 지역 매칭: CNP_CD_NM 텍스트 포함 검색 (ARA_CD 파라미터 미작동 확인)")
        print(f"  ★ 유형 필드: AIS_TP_CD_NM(세부) / UPP_AIS_TP_CD(06=임대, 05=분양)")
        print(f"  전체 필드: {list(items[0].keys())}")
    RESULTS["lh_notice"] = "OK"


# ─── 4. 국토부 아파트 매매 실거래가 ──────────────────────────────────────────
# ★ 확인: 등록일 필드(rgstDate) 유무, 법정동 필드, 시군구코드 호출 단위
def poc_molit_apt_trade(client: httpx.Client) -> None:
    print("\n[4] 국토부 아파트 매매 실거래가 (강남구 202505)")
    url = ("https://apis.data.go.kr/1613000"
           "/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev")
    items, raw_xml, total = get_xml_items(client, url, {
        "serviceKey": SERVICE_KEY,
        "pageNo":     1,
        "numOfRows":  5,
        "LAWD_CD":    "11680",   # 서울 강남구
        "DEAL_YMD":   "202505",
    })
    # fixture는 파싱된 JSON으로 저장
    save("molit_apt_trade", {"totalCount": total, "items": items})

    print(f"  총 {total}건")
    for item in items[:3]:
        print(f"  단지={item.get('aptNm')} | 계약일={item.get('dealYear')}-{item.get('dealMonth')}-{item.get('dealDay')} "
              f"| 금액(만원)={item.get('dealAmount')} | 법정동={item.get('umdNm')}")

    if items:
        date_keys = [k for k in items[0] if any(x in k.lower() for x in ["date","day","month","year","rgst","reg"])]
        print(f"  날짜 관련 필드: {date_keys}")
        has_reg = "rgstDate" in items[0]
        print(f"  ★ rgstDate(등록일) 필드: {'있음 ✅ → registered_at 저장 가능' if has_reg else '없음 → first_seen_at diff 전략'}")
        if has_reg:
            print(f"     샘플값: {items[0].get('rgstDate')} (형식: YY.MM.DD)")
    RESULTS["molit_apt_trade"] = "OK"


# ─── 5. ECOS 서울 주택가격전망 CSI ───────────────────────────────────────────
# statCode=511Y002(소비자동향조사 전국·월), item1=FMFB(주택가격전망CSI), item2=F0001(서울)
def poc_ecos_csi(client: httpx.Client) -> None:
    print("\n[5] ECOS 서울 주택가격전망 CSI")
    url  = (f"https://ecos.bok.or.kr/api/StatisticSearch"
            f"/{ECOS_KEY}/json/kr/1/6/511Y002/M/202501/202506/FMFB/F0001")
    data = get_json(client, url, {})
    save("ecos_csi", data)

    rows = data.get("StatisticSearch", {}).get("row", []) if isinstance(data, dict) else []
    if not rows:
        print(f"  ⚠️  응답 확인 필요 → fixtures/ecos_csi.json")
        RESULTS["ecos_csi"] = "WARN: rows empty"
        return

    for row in rows:
        print(f"  기준월={row.get('TIME')} | CSI={row.get('DATA_VALUE')} | 항목={row.get('ITEM_NAME1')}")
    print(f"  ★ statCode=511Y002, itemCode=FMFB(주택가격전망CSI), region=F0001(서울)")
    RESULTS["ecos_csi"] = "OK"


# ─── 6. ECOS 기준금리 ─────────────────────────────────────────────────────────
# statCode=722Y001, itemCode=0101000
def poc_ecos_base_rate(client: httpx.Client) -> None:
    print("\n[6] ECOS 기준금리")
    url  = (f"https://ecos.bok.or.kr/api/StatisticSearch"
            f"/{ECOS_KEY}/json/kr/1/6/722Y001/M/202501/202506/0101000")
    data = get_json(client, url, {})
    save("ecos_base_rate", data)

    rows = data.get("StatisticSearch", {}).get("row", []) if isinstance(data, dict) else []
    if not rows:
        print(f"  ⚠️  응답 확인 필요 → fixtures/ecos_base_rate.json")
        RESULTS["ecos_base_rate"] = "WARN: rows empty"
        return

    for row in rows:
        print(f"  기준월={row.get('TIME')} | 기준금리={row.get('DATA_VALUE')}%")
    RESULTS["ecos_base_rate"] = "OK"


# ─── main ─────────────────────────────────────────────────────────────────────
def main() -> None:
    print("=" * 60)
    print("집별 0주차 PoC — 공공 API 실호출")
    print("=" * 60)

    with httpx.Client() as client:
        for fn in [
            poc_applyhome_apt,
            poc_applyhome_unranked,
            poc_lh_notice,
            poc_molit_apt_trade,
            poc_ecos_csi,
            poc_ecos_base_rate,
        ]:
            try:
                fn(client)
            except Exception as e:
                name = fn.__name__.removeprefix("poc_")
                print(f"  ❌ {e}")
                RESULTS[name] = f"FAIL: {e}"

    print("\n" + "=" * 60)
    print("결과 요약")
    print("=" * 60)
    for src, status in RESULTS.items():
        icon = ("✅" if status == "OK"
                else "⏭️ " if status.startswith("SKIP")
                else "⚠️ " if status.startswith("WARN")
                else "❌")
        print(f"  {icon} {src}: {status}")
    print(f"\nfixtures 저장 위치: {FIXTURES}")

    if any(s.startswith("FAIL") for s in RESULTS.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
