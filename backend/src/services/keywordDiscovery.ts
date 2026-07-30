/**
 * 후보 키워드 발굴 (discovery)
 *
 * 왜 필요한가:
 *   네이버 데이터랩 검색어트렌드 API는 "이 키워드가 얼마나 뜨나?"에만 답한다.
 *   키워드를 먼저 줘야 지수를 돌려주는 구조라서, "뭐가 뜨고 있나?"는 알 수 없다.
 *   네이버는 급상승 키워드 목록 API도 제공하지 않는다(실시간 검색어는 2021년 폐지).
 *   그래서 감시할 후보를 실제 콘텐츠에서 찾아내는 단계가 따로 필요하다.
 *
 * 두 소스에서 가져온다 — 둘 다 "지금 실제로 올라오고 있는 콘텐츠"다:
 *   1) 유튜브 인기 급상승 영상 제목 (1 unit)
 *   2) 네이버 블로그·카페글 최신 포스트 제목 (하루 25,000회 한도)
 *
 * === 언급 빈도가 핵심 신호다 ===
 *
 * 초기 구현은 추출한 단어를 Set에 넣어 중복을 없앴다. 그러면 제목 1000개에서
 * 30번 나온 '두바이초콜릿'과 1번 나온 '식빵'이 똑같이 후보 1개가 되어,
 * 결과가 "요즘 화제"가 아니라 "어디에나 있는 메뉴 목록"이 되어버린다.
 *
 * 그래서 등장 횟수(mentionCount)를 함께 센다.
 * "최근 글에 자주 나오는데 검색량은 아직 낮다"가 태동기의 신호이기 때문이다.
 */

import { NaverSearchCorpus, searchNaver } from './naverSearch';
import { discoverVideosByQuery } from './youtubeApi';

/**
 * 디저트/음료의 "형태" — 제목에서 키워드를 골라내는 기준.
 * 이 목록으로 키워드를 만들어내는 게 아니라, 실제 제목에 등장한 단어 중
 * 음식/음료로 보이는 것만 추려내는 필터로 쓴다.
 */
const FORMS = [
  '라떼', '아메리카노', '에이드', '스무디', '프라페', '주스', '쉐이크',
  '케이크', '롤케이크', '치즈케이크', '타르트', '마카롱', '쿠키', '스콘',
  '크루아상', '크로플', '베이글', '도넛', '마들렌', '휘낭시에', '푸딩',
  '빵', '토스트', '파이', '무스', '젤라또', '아이스크림', '빙수', '초콜릿',
  '소보로', '단팥', '슈크림', '와플', '팬케이크', '브라우니', '몽블랑',
  // 차(茶)는 '티' 한 글자로 받으면 안 된다. 아래 NON_FORM_ENDINGS 주석 참고.
  // 대신 차를 가리키는 게 확실한 조합만 나열한다. 목록이 길어 보여도
  // 한 글자 '티'를 허용해 챗지피티·트리니티까지 받는 것보다 낫다.
  '밀크티', '블랙티', '그린티', '허브티', '버블티', '레몬티', '민트티', '아이스티',
  '자몽티', '유자티', '복숭아티', '얼그레이티', '캐모마일티', '루이보스티',
  '자스민티', '우롱티', '히비스커스티', '애프터눈티', '보리차', '홍차', '녹차', '말차',
];

/**
 * 짧고 흔한 형태 단어는 가게 이름에도 자주 쓰인다(천하제빵, 더벤티).
 * 이런 형태로 끝나는 토큰은 앞부분이 충분히 길 때만 인정한다.
 */
const SHORT_FORMS = new Set(['빵', '파이', '무스']);
const MIN_PREFIX_FOR_SHORT_FORM = 2;

/*
 * 한때 '밀크티', '빙수', '아메리카노' 같은 단독 형태 단어를 허용했지만 되돌렸다.
 *
 * "빙수가 뜬다"는 사장님이 쓸 수 있는 정보가 아니다. 여름이면 당연히 뜨고,
 * 알아도 뭘 만들지 알 수 없다. "망고빙수가 뜬다"여야 행동으로 이어진다.
 * 형태 단어 단독은 카테고리 이름이지 메뉴 이름이 아니다.
 *
 * 그래서 모든 형태 단어는 앞말이 붙어야만 인정한다 (아래 token.length > form.length).
 */

/**
 * 형태 단어로 끝나 보이지만 카페 메뉴가 아닌 것들.
 *
 * '티'를 형태 단어에서 뺀 이유가 여기 있다. 한 글자라 앞말 길이 제한으로는
 * 못 막는데, 실제로 이렇게 새어 들어왔다:
 *   돼지게티(라면), 마티에부산하버시티(호텔), 핏제리아디토티(피자집)
 * 셋 다 '티' 앞이 2자를 훌쩍 넘어서 기존 규칙을 통과했다.
 * 그래서 '티'는 버리고 밀크티·블랙티처럼 차를 가리키는 게 확실한 조합만 FORMS에 넣었다.
 *
 * 아래 목록은 그 밖의 비(非)디저트 어미다. '편의점 신메뉴'를 검색어에 넣은 뒤로
 * 라면·간편식이 같이 딸려 오기 때문에 필요하다.
 */
const NON_FORM_ENDINGS = [
  '게티', '라면', '짜장', '짬뽕', '우동', '국수', '도시락', '볶음밥', '김밥',
  '시티', '호텔', '리조트', '스테이', '아파트', '오피스텔',
];

/**
 * 마케팅 카테고리의 "형태".
 *
 * 디저트·음료와 어휘 체계가 완전히 다르다. 메뉴 이름은 '재료 + 형태'(흑임자라떼)로
 * 끝나지만, 마케팅 트렌드는 '활동 + 형식'(굿즈 이벤트, 팝업스토어, 브이로그 챌린지)
 * 형태라 FORMS로는 하나도 잡히지 않는다. 실제로 마케팅 카드가 0개였던 이유다.
 */
const MARKETING_SUFFIXES = [
  '이벤트', '챌린지', '팝업', '팝업스토어', '콜라보', '굿즈', '마케팅',
  '프로모션', '클래스', '체험', '스탬프', '쿠폰', '멤버십', '뽑기',
];

/**
 * 그 자체로 하나의 마케팅 소재인 단어들.
 * 접미사와 달리 앞말 없이도 유효하다 ('리유저블컵', '포토존').
 */
const MARKETING_TERMS = [
  '리유저블컵', '텀블러', '키링', '스티커', '포토존', '럭키박스', '선물세트',
];

/**
 * MARKETING_TERMS의 접미사 매칭에 걸리지만 별도 카드로 둘 이유가 없는 것들.
 * '설선물세트'는 '선물세트'와 사실상 같은 이야기라 카드가 둘로 쪼개진다.
 * 게다가 명절 한정이라 7월에는 의미가 없다.
 */
const REDUNDANT_MARKETING = ['설선물세트', '추석선물세트', '명절선물세트'];

/** 접미사형은 앞말이 있어야 인정한다 ('이벤트' 단독은 너무 일반적이라 제외) */
const MIN_PREFIX_FOR_MARKETING = 2;

/**
 * 앞말이 붙어 있어도 마케팅 "트렌드"가 아닌 조합.
 *
 * MIN_PREFIX_FOR_MARKETING만으로는 못 막는다. 네이버 카페글에는 홍보·광고 글이
 * 많아서 '무료체험', '경품이벤트', '톡톡이벤트', '업체전용이벤트' 같은 표현이
 * 대량으로 잡히는데, 앞말이 2자 이상이라 규칙을 통과한다.
 *
 * 사장님이 알고 싶은 건 "요즘 카페들이 뭘 하나"이지, 광고 글의 상투어가 아니다.
 * 판단 기준: 특정 카페/브랜드를 떠올릴 수 있으면 트렌드, 아무 업종에나 붙으면 노이즈.
 */
const GENERIC_MARKETING = [
  '무료체험', '체험단', '경품이벤트', '톡톡이벤트', '업체전용이벤트', '전용이벤트',
  '오픈이벤트', '가입이벤트', '출석이벤트', '댓글이벤트', '공유이벤트', '홍보이벤트',
  '할인이벤트', '특가이벤트', '브이이벤트',
  // 카페 마케팅이 아니라 개인 재테크 유행. 블로그에 대량으로 올라온다
  '현금챌린지', '무지출챌린지', '절약챌린지', '가계부챌린지',
];

/**
 * 형태 단어 앞에 붙어도 메뉴 이름이 되지 못하는 수식어.
 *
 * '신상아이스크림', '신상빵', '건강빵', '일반빵'처럼 **수식어 + 형태** 조합은
 * 특정 메뉴를 가리키지 않는다. 사장님이 "신상아이스크림이 뜬다"는 말을 듣고
 * 할 수 있는 게 없다 — 어떤 아이스크림인지 모르니까.
 * 앞말 길이 제한으로는 못 막는다(전부 2자 이상이라 통과한다).
 */
const GENERIC_PREFIXES = [
  '신상', '신메뉴', '인기', '추천', '유명', '일반', '건강', '기본',
  '맛있는', '존맛', '대박', '최고', '요즘', '오늘', '수제', '특별',
];

/** 제목에서 뽑히면 안 되는 흔한 단어들 */
const STOPWORDS = new Set([
  '카페', '디저트', '음료', '메뉴', '신메뉴', '레시피', '만들기', '먹방',
  '리뷰', '추천', '브이로그', '맛집', '오늘', '진짜', '최고', '요즘',
  '집에서', '초간단', '만드는법', '먹어봤다', '후기', '내돈내산', '광고',
  '존맛', '꿀맛', '데일리', '일상', '기록', '방문', '후불', '이벤트',
  '단백질쉐이크', '후무스', '식빵', '흰빵', '밥빵',
  // 식품 유형/재료 명칭 — 유행이 아니라 분류 이름이다.
  // '준초콜릿'은 카카오 함량 낮은 초콜릿의 법적 분류명인데, 홈베이킹 재료
  // 글에 대량으로 등장해 카드까지 만들어졌다.
  '준초콜릿', '커버춰초콜릿', '가공유', '혼합음료',
  // '파이'로 끝나는 음식 아닌 외래어. 카페 글에 자주 등장해 교차검증도 통과한다
  // (카페에서 스포티파이 틀어놓고 와이파이 되냐고 묻는 글이 흔하다)
  '스포티파이', '와이파이', '하이파이', '파파이', '샤오미파이',
]);

/**
 * 프랜차이즈·유명 가게 이름 — 형태 단어로 끝나서 걸리지만 메뉴가 아니다.
 * 사장님이 알고 싶은 건 "그 가게 이름"이 아니라 "그 가게에서 뜨는 디저트"다.
 */
const BRAND_NAMES = new Set([
  '더벤티', '메가커피', '컴포즈커피', '빽다방', '이디야', '투썸플레이스',
  '할리스', '엔제리너스', '탐앤탐스', '파스쿠찌', '커피빈', '폴바셋',
  '천하제빵', '성심당', '뚜레쥬르', '파리바게뜨', 'london베이글',
  '런던베이글', '노티드', '아우어베이커리', '탄티', '공차', '쥬씨',
  // 형태 단어(토스트/도넛/소금빵...)로 끝나서 걸리는 프랜차이즈·유명 매장.
  // 교차검증으로는 못 거른다 — 유명할수록 블로그·카페 양쪽에서 언급되어
  // 오히려 잘 통과하기 때문이다. 실측에서 카드까지 만들어진 것들:
  '이삭토스트', '던킨도넛', '아임도넛', '자연도소금빵',
  '랜디스도넛', '올드페리도넛', '미스터도넛', '오도넛',
  '파더스베이글', '올드몬트베이글', '미친베이글', '휘베이글',
  '꼬모젤라또', '미켈란젤라또', '패럿커피앤아이스크림',
  '헬로키티', '마미파이', '문토스트',
  '텐라떼',   // 텐퍼센트커피 브랜드 메뉴
  '콩지니빵', // 부산역 디저트 가게
]);

/**
 * 지역명 — '창원소금빵'처럼 앞에 붙으면 벗겨내고,
 * '서울빵'처럼 벗기고 나면 형태 단어만 남는 경우는 버린다.
 */
const REGION_PREFIXES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
  '수원', '성남', '용인', '고양', '창원', '청주', '천안', '전주', '포항',
  '김해', '평택', '안산', '안양', '남양주', '화성', '제천', '강남', '홍대',
  '연남', '성수', '망원', '이태원', '건대', '신촌', '잠실', '해운대',
];

/**
 * 네이버 블로그·카페에서 검색할 쿼리 — 신상/유행 이야기가 모이는 표현 위주.
 *
 * 편의점 신상을 포함하는 이유: 국내 디저트·음료 유행은 편의점에서 먼저
 * 터지고 카페로 넘어오는 경우가 많다(두바이초콜릿이 대표적). 카페 쪽만
 * 보면 이미 확산된 뒤에야 잡히므로, 선행 지표로 함께 훑는다.
 */
export const NAVER_DISCOVERY_QUERIES = [
  // 디저트·음료
  '카페 신메뉴',
  '요즘 유행 디저트',
  '신상 디저트',
  '베이커리 신상',
  '카페 신상 음료',
  '디저트 추천',
  '카페 시그니처 메뉴',
  '요즘 뜨는 음료',
  // 편의점 — 국내 디저트 유행은 편의점에서 먼저 터지는 경우가 많다
  '편의점 신메뉴',
  '편의점 신상 디저트',
  '편의점 신상 음료',
  // 마케팅 — 어휘 체계가 달라 따로 검색해야 잡힌다.
  // 다른 카테고리보다 검색어를 많이 두는 이유: 마케팅 표현은 디저트 이름보다
  // 훨씬 다양해서(굿즈/콜라보/스탬프/사은품...) 좁게 검색하면 카드가 거의 안 나온다.
  // 실측에서 카드 58개 중 마케팅이 4개뿐이었다.
  '카페 이벤트',
  '카페 굿즈',
  '카페 팝업스토어',
  '카페 마케팅',
  '베이커리 이벤트',
  '카페 콜라보',
  '카페 사은품',
  '카페 스탬프 적립',
  '카페 멤버십 혜택',
  '디저트 팝업',
  '카페 신상 굿즈',
  '카페 인스타 이벤트',
];

/**
 * 지난 유행을 캐기 위한 검색어 — 위 목록과 **다른 방식으로** 쓴다.
 *
 * === 왜 따로 두나 ===
 *
 * 위 검색어들은 최신순(sort=date)으로 부른다. 지금 올라오는 글을 봐야
 * "지금 뜨는 것"을 알 수 있기 때문이다. 그런데 그 방식으로는 지난 유행이
 * 구조적으로 안 잡힌다 — 흑당버블티는 지금 아무도 글을 안 쓰니까.
 *
 * 그래서 이 목록은 **정확도순(sort=sim)으로, 깊게** 부른다. 3년 전 글이든
 * 상관없이 그 주제에 가장 맞는 글을 가져오는 방식이다. 사람들이 "그때 뭐가
 * 유행했었지" 하고 정리해둔 글이 걸리고, 거기서 과거 키워드를 얻는다.
 *
 * === 검색어를 왜 이렇게 많이 ===
 *
 * 회고 글은 표현이 제각각이다. "유행 지난", "한때 유행했던", "추억의",
 * "그때 그", "안 보이는", "사라진"... 하나로는 몇 건 못 건진다.
 * 연도를 박은 검색어는 특정 시기 유행을 직접 겨냥한다.
 *
 * 이렇게 모은 키워드는 수집 후 검색량이 낮게 나오고, 그게 그대로
 * 하락기(declining) 카드가 되어 "지난 유행" 섹션을 채운다.
 */
export const NAVER_ARCHIVE_QUERIES = [
  // 일반 회고
  '유행 지난 디저트',
  '한때 유행했던 카페 메뉴',
  '한때 유행했던 디저트',
  '예전에 유행하던 음료',
  '요즘 안 보이는 음료',
  '요즘 안 보이는 디저트',
  '사라진 카페 메뉴',
  '단종된 음료',
  '단종된 디저트',
  '추억의 디저트',
  '추억의 음료',
  '그때 그 시절 카페',
  '옛날 카페 메뉴',
  // 정리·회고 글 형식
  '카페 트렌드 정리',
  '디저트 유행 변천사',
  '역대 카페 유행',
  '디저트 유행 순서',
  '카페 메뉴 역사',
  // 연도별 — 특정 시기 유행을 직접 겨냥한다
  '작년 유행 디저트',
  '재작년 유행 디저트',
  '2024 유행 디저트',
  '2023 유행 디저트',
  '2022 유행 디저트',
  '2021 유행 음료',
  '2020 유행 디저트',
  '2024 카페 트렌드',
  '2023 카페 트렌드',
  '2022 카페 트렌드',
  // 유행의 흥망을 이야기하는 표현
  '이제 안 먹는 디저트',
  '한물간 디저트',
  '반짝 유행 음료',
  '유행 끝난 빵',
];

/**
 * 쿼리당 몇 페이지까지 파고들지.
 *
 * 한 페이지 = 글 100개. 예전엔 1페이지만 봐서 각 쿼리의 **최신 100개**만
 * 훑었다. 그래서 발굴을 여러 번 돌려도 같은 글을 다시 읽을 뿐 새 키워드가
 * 거의 안 늘었다(실측: 144개 중 신규 1개).
 *
 * 자주 돌리는 것보다 깊게 파는 게 낫다. 블로그 글이 쌓이는 속도보다 발굴
 * 주기가 빨라서, 10분마다 돌려봐야 같은 100개를 다시 본다. 반면 페이지를
 * 늘리면 며칠치 글을 한 번에 훑는다.
 *
 * 교차검증 통과율도 같이 오른다. 각 소스에서 더 많은 제목을 보면
 * "블로그와 카페 양쪽에 다 나오는" 키워드가 잡힐 확률이 커지기 때문이다.
 *
 * 비용: 5페이지 × 21쿼리 × 2코퍼스 = 210회/실행.
 * 하루 24회 돌려도 5,040회로 네이버 한도(25,000)의 20%다.
 */
const DEFAULT_DISCOVERY_PAGES = Number(process.env.NAVER_DISCOVERY_PAGES) || 5;

/** 네이버 검색 API의 start 상한이 1000이라 10페이지가 물리적 한계다 */
const MAX_DISCOVERY_PAGES = 10;

/**
 * 유튜브 검색 쿼리. 쿼리당 101 unit이라 네이버(1회당 1건)보다 적게 쓴다.
 * 4개 쿼리 = 404 unit (하루 10,000 중 4%).
 */
export const YOUTUBE_DISCOVERY_QUERIES = [
  '카페 신메뉴',
  '요즘 유행 디저트',
  '신상 디저트 리뷰',
  '편의점 신상',
  '카페 이벤트 굿즈',
];

/**
 * 발굴 소스 — 교차 검증을 위해 개별로 구분한다.
 *
 * 어떤 소스도 편향이 있다. 블로그는 체험단·협찬이 많고, 카페글은 카페별로
 * 연령대가 갈리며, 유튜브는 채널 구독자층이 다르다. 한 소스에서만 잡힌
 * 키워드는 그 소스의 편향일 수 있으므로, 여러 소스에서 동시에 잡힌 것을
 * 더 신뢰한다. 개인 카페·빵집 이름이 대개 블로그 한 곳에서만 나온다는
 * 점에서 가게 이름 노이즈도 함께 걸러진다.
 */
export type DiscoverySource = 'blog' | 'cafe' | 'youtube';

export interface DiscoveredKeyword {
  keyword: string;
  source: DiscoverySource;
  /** 훑어본 제목들에서 몇 번 등장했는지 */
  mentionCount: number;
}

export interface DiscoveryAttempt {
  target: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface DiscoveryResult {
  keywords: DiscoveredKeyword[];
  /** 훑어본 제목 수 — 0이면 API 호출 자체가 실패했다는 뜻 */
  titlesScanned: number;
  attempts: DiscoveryAttempt[];
}

/**
 * 토큰 하나가 유효한 메뉴 키워드인지 판정하고, 필요하면 정규화해서 돌려준다.
 * 유효하지 않으면 null.
 */
export function normalizeKeyword(rawToken: string): string | null {
  let token = rawToken;

  if (token.length < 2 || token.length > 20) return null;
  if (STOPWORDS.has(token)) return null;
  if (BRAND_NAMES.has(token)) return null;
  // 마케팅 분기보다 먼저 검사한다. 어느 경로로도 통과하면 안 되는 어미다.
  if (NON_FORM_ENDINGS.some((e) => token.endsWith(e))) return null;

  // '창원소금빵' -> '소금빵' : 지역명은 메뉴 이름의 일부가 아니다
  for (const region of REGION_PREFIXES) {
    if (token.startsWith(region) && token.length > region.length + 1) {
      token = token.slice(region.length);
      break;
    }
  }

  // 지역명을 벗기고 나서 다시 검사 ('서울빵' -> '빵'은 형태 단어 그 자체라 탈락)
  if (token.length < 2) return null;
  if (STOPWORDS.has(token) || BRAND_NAMES.has(token)) return null;

  // 마케팅 소재는 그 자체로 유효하다 ('리유저블컵', '포토존')
  if (REDUNDANT_MARKETING.includes(token)) return null;
  if (MARKETING_TERMS.some((t) => token.endsWith(t))) return token;

  // 광고 글의 상투어는 앞말이 붙어 있어도 트렌드가 아니다
  if (GENERIC_MARKETING.includes(token)) return null;

  // 접미사형은 앞말이 붙어야 한다 ('굿즈이벤트' O, '이벤트' X)
  const marketingSuffix = MARKETING_SUFFIXES.find(
    (f) => token.endsWith(f) && token.length - f.length >= MIN_PREFIX_FOR_MARKETING
  );
  if (marketingSuffix) return token;

  // 형태 단어는 반드시 앞말이 있어야 한다 ('빙수' X, '망고빙수' O)
  const form = FORMS.find((f) => token.endsWith(f) && token.length > f.length);
  if (!form) return null;

  const prefix = token.slice(0, token.length - form.length);

  // 형태 단어 앞이 지역명 그 자체면 메뉴가 아니라 지역 특산/가게를 가리킨다
  // ('서울빵', '대전빵' X). 위에서 벗기지 못한 짧은 조합이 여기서 걸린다.
  if (REGION_PREFIXES.includes(prefix)) return null;

  // 수식어 + 형태는 특정 메뉴를 가리키지 않는다 ('신상아이스크림', '건강빵')
  if (GENERIC_PREFIXES.includes(prefix)) return null;

  // 숫자로 시작하면 제품 스펙 표기지 메뉴 이름이 아니다 ('120겹파이', '1000원빵')
  if (/^[0-9]/.test(token)) return null;

  // '빵', '티' 같은 짧은 형태는 가게 이름에도 흔하다.
  // 앞에 붙는 말이 2자 이상일 때만 메뉴로 인정한다 ('탄티' X, '밀크티' O)
  if (SHORT_FORMS.has(form) && prefix.length < MIN_PREFIX_FOR_SHORT_FORM) {
    return null;
  }

  return token;
}

/**
 * 제목 목록에서 음식/음료로 보이는 한글 토큰을 추출하고 등장 횟수를 센다.
 *
 * 형태소 분석기 없이 처리하기 위해 "FORMS로 끝나는 토큰"을 고른 뒤,
 * 지역명·브랜드명·짧은 접두어를 걸러낸다. 정밀하진 않지만 오탐이 나와도
 * 다음 단계에서 검색량으로 다시 걸러지므로 실용상 충분하다.
 */
export function extractKeywordsFromTitles(
  titles: string[],
  source: DiscoverySource
): DiscoveredKeyword[] {
  const counts = new Map<string, number>();

  for (const title of titles) {
    // 한글/영문/숫자만 남기고 나머지는 구분자로 취급
    const tokens = title.split(/[^가-힣a-zA-Z0-9]+/).filter(Boolean);

    // 같은 제목에 같은 단어가 반복돼도 1회로 센다 (제목 = 하나의 언급)
    const seenInTitle = new Set<string>();

    for (const token of tokens) {
      const normalized = normalizeKeyword(token);
      if (!normalized || seenInTitle.has(normalized)) continue;
      seenInTitle.add(normalized);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([keyword, mentionCount]) => ({ keyword, source, mentionCount }))
    .sort((a, b) => b.mentionCount - a.mentionCount);
}

/**
 * 유튜브에서 주제 검색으로 후보 키워드를 뽑는다.
 *
 * 인기 급상승 차트(chart=mostPopular)는 1 unit으로 저렴하지만, 한국 유튜브
 * 인기 차트는 음악·예능이 점령하고 있어 카페 디저트 키워드가 사실상 나오지
 * 않는다(실측: 제목 157개에서 0개 추출).
 *
 * 그래서 주제 쿼리로 직접 검색한다. 특정 채널을 골라 넣지 않는 이유는,
 * 고르는 사람의 취향과 그 채널 구독자층의 편향이 그대로 들어가기 때문이다.
 * 검색으로 매번 새로 뽑으면 지금 이 주제에서 조회수가 잘 나오는 영상이
 * 자연스럽게 올라오고, 유행이 바뀌면 구성도 알아서 바뀐다.
 *
 * 비용: 쿼리당 101 unit. 기본 3개 쿼리 = 303 unit (하루 10,000 중 3%).
 */
export async function discoverFromYoutube(
  queries: string[] = YOUTUBE_DISCOVERY_QUERIES
): Promise<DiscoveryResult> {
  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];

  for (const query of queries) {
    const target = `youtube:${query}`;
    try {
      const videos = await discoverVideosByQuery(query);
      titles.push(...videos.map((v) => v.title));
      attempts.push({ target, ok: true, count: videos.length });
    } catch (err) {
      attempts.push({
        target,
        ok: false,
        count: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    keywords: extractKeywordsFromTitles(titles, 'youtube'),
    titlesScanned: titles.length,
    attempts,
  };
}

/**
 * 네이버 블로그 또는 카페글에서 후보 키워드를 뽑는다.
 *
 * 블로그와 카페를 한 번에 합치지 않고 코퍼스별로 따로 호출하는 이유는,
 * 교차 검증을 하려면 "어느 소스에서 나왔는지"를 구분해야 하기 때문이다.
 *
 * 검색 API는 하루 25,000회라 데이터랩(1,000회)과 별도로 여유롭다.
 */
export async function discoverFromNaver(
  corpus: NaverSearchCorpus = 'blog',
  queries: string[] = NAVER_DISCOVERY_QUERIES,
  pages: number = DEFAULT_DISCOVERY_PAGES,
  /**
   * date = 최신순. "지금 뜨는 것"을 찾을 때.
   * sim  = 정확도순. 지난 유행처럼 오래된 글까지 뒤져야 할 때.
   */
  sort: 'date' | 'sim' = 'date'
): Promise<DiscoveryResult> {
  const titles: string[] = [];
  const attempts: DiscoveryAttempt[] = [];
  const pageCount = Math.min(Math.max(pages, 1), MAX_DISCOVERY_PAGES);

  for (const query of queries) {
    const target = `naver:${corpus}:${query}`;
    let collected = 0;
    let lastError: string | null = null;

    for (let page = 0; page < pageCount; page += 1) {
      try {
        // start는 1, 101, 201... 로 올라간다 (API 상한 1000)
        const result = await searchNaver(query, corpus, 100, page * 100 + 1, sort);
        titles.push(...result.titles);
        collected += result.titles.length;

        // 결과가 100개 미만이면 더 뒤에는 글이 없다는 뜻이라 멈춘다.
        // 없는 페이지를 계속 부르면 할당량만 쓴다.
        if (result.titles.length < 100) break;
      } catch (err) {
        // 한 페이지가 실패해도 앞에서 모은 건 살린다. 뒤 페이지는 포기한다
        lastError = err instanceof Error ? err.message : String(err);
        break;
      }
    }

    attempts.push(
      lastError && collected === 0
        ? { target, ok: false, count: 0, error: lastError }
        : { target, ok: true, count: collected }
    );
  }

  return {
    keywords: extractKeywordsFromTitles(titles, corpus === 'blog' ? 'blog' : 'cafe'),
    titlesScanned: titles.length,
    attempts,
  };
}
