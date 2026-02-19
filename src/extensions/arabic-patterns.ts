/* eslint-disable no-misleading-character-class */

export const FULL_ACTION_VERB_SET = new Set([
  'يدخل',
  'يخرج',
  'ينظر',
  'يرفع',
  'يضع',
  'يقول',
  'يلتفت',
  'يقف',
  'يجلس',
  'يجري',
  'يمشي',
  'يركض',
  'يصرخ',
  'يبكي',
  'يضحك',
  'يأكل',
  'يشرب',
  'ينام',
  'يستيقظ',
  'يكتب',
  'يقرأ',
  'يسمع',
  'يلمس',
  'يفتح',
  'يغلق',
  'يبدأ',
  'ينتهي',
  'يذهب',
  'يعود',
  'يأتي',
  'يتوقف',
  'ينهض',
  'يبتسم',
  'يتجه',
  'يتنهد',
  'يهمس',
  'يتكلم',
  'يحدق',
  'يقتحم',
  'يتوضأ',
  'نرى',
  'نسمع',
  'نلاحظ',
  'ترفع',
  'تجلس',
  'تقوم',
  'تدخل',
  'تظهر',
])

export const SCENE_NUMBER_RE = /(?:مشهد|scene)\s*([0-9٠-٩]+)/i
export const SCENE_NUMBER_EXACT_RE = /^\s*(?:مشهد|scene)\s*[0-9٠-٩]+/i
export const SCENE_TIME_RE = /(نهار|ليل|صباح|مساء|فجر)/i
export const SCENE_LOCATION_RE = /(داخلي|خارجي)/i

export const TRANSITION_RE =
  /^(?:قطع(?:\s*(?:إلى|الى))?|مزج(?:\s*(?:إلى|الى))?|تلاشي(?:\s*(?:إلى|الى))?|ذوبان(?:\s*(?:إلى|الى))?|fade\s*(?:in|out|to)?|cut\s*to|dissolve\s*to|smash\s*cut|اختفاء|تحول|انتقال)\s*:?[\s]*$/i

export const SCENE_HEADER3_PREFIX_RE =
  /^(مسجد|بيت|منزل|فيلا|شقة|قصر|شارع|حديقة|مدرسة|جامعة|مكتب|محطة|مطار|مباحث|مستشفى|مطعم|فندق|سيارة|غرفة|قاعة|ممر|سطح|ساحة|ميدان|مكتبة|صالة|حمام|مطبخ|شرفة)/i

export const SCENE_HEADER3_RANGE_RE =
  /^(مسجد|بيت|منزل|فيلا|شقة|قصر|مكتب|محطة|مطار|مباحث|مستشفى|مطعم|فندق)\s+[\u0600-\u06FF\s0-9٠-٩]+\s*[–—-]\s*[\u0600-\u06FF\s0-9٠-٩]+/i

export const SCENE_HEADER3_MULTI_LOCATION_EXACT_RE =
  /^(منزل|بيت|مكتب|شقة|فيلا|قصر|محل|مصنع|مستشفى|مدرسة|جامعة|فندق|مطعم|مقهى|شركة|بنك|مركز|مباحث|محطة|مطار)\s+[\u0600-\u06FF\s0-9٠-٩]+(?:\s*[–—-]\s*[\u0600-\u06FF\s0-9٠-٩]+)+$/i

export const ACTION_CUE_RE =
  /^(?:مبتسما|مبتسمة|متنهدا|بهدوء|بغضب|بفزع|بحنق|بحدة|محتدة|بصوت\s+(?:خفيض|عالي)|بمنتهى\s+الهدوء)$/i

export const IMPERATIVE_VERBS = ['ادخل', 'اخرج', 'انظر', 'توقف', 'اسمع', 'تعال', 'امش', 'اكتب', 'اقرأ', 'اجلس', 'قف', 'اركض']
export const IMPERATIVE_VERB_SET = new Set(IMPERATIVE_VERBS)
export const IMPERATIVE_VERB_RE = new RegExp(`^\\s*(?:${IMPERATIVE_VERBS.join('|')})(?:\\s+\\S|$)`)

const PATTERN_PRONOUN = /(?:(?:و|ف)?(?:هو|هي|هم|هن)\s+)/.source
const PATTERN_MAZAL =
  /(?:(?:ما|لا|لم|لن)\s*(?:زال|يزال|تزال|برح|فتئ|انفك)(?:[توناواي]{1,3})?\s+)/.source
const PATTERN_VERB = /[يتنأ][\u0600-\u06FF]{2,}/.source
const STRONG_ACTION_BODY = `(?:${PATTERN_PRONOUN}(?:${PATTERN_MAZAL})?|${PATTERN_MAZAL})${PATTERN_VERB}`

export const PRONOUN_ACTION_RE = new RegExp(`^${STRONG_ACTION_BODY}`)

export const ACTION_START_PATTERNS: RegExp[] = [
  new RegExp(`^\\s*(?:ثم\\s+)?${STRONG_ACTION_BODY}(?:\\s+\\S|$)`),
  /^\s*(?:و|ف|ل)?(?:نرى|نسمع|نلاحظ|نقترب|نبتعد|ننتقل)(?:\s+\S|$)/,
  /^\s*(?:رأينا|سمعنا|لاحظنا|شاهدنا)(?:\s+\S|$)/,
  IMPERATIVE_VERB_RE,
  /^\s*لا\s+[يت][\u0600-\u06FF]{2,}(?:\s+\S|$)/,
]

export const NEGATION_PLUS_VERB_RE = /^لا\s+[ي][\u0600-\u06FF]{2,}/
export const VERB_WITH_PRONOUN_SUFFIX_RE =
  /[يت][\u0600-\u06FF]{2,}(?:ه|ها|هم|هن|ني|نا|ك|كم|كن)(?:\s|$)/

export const CHARACTER_RE =
  /^\s*(?:صوت\s+)?[\u0600-\u06FF][\u0600-\u06FF\s0-9٠-٩]{0,30}:?\s*$/

export const SHORT_DIALOGUE_WORDS = [
  'نعم',
  'لا',
  'أيوه',
  'لأ',
  'آه',
  'أوه',
  'اه',
  'اوه',
  'حاضر',
  'تمام',
  'ماشي',
  'حسنا',
  'طيب',
  'ليه',
  'إزاي',
  'فين',
  'إمتى',
  'مين',
  'ازاي',
  'امتى',
  'حقا',
  'طبعا',
  'اكيد',
  'ممكن',
  'مستحيل',
  'معقول',
  'يلا',
  'خلاص',
]

export const CHARACTER_STOP_WORDS = new Set([
  'في',
  'على',
  'من',
  'إلى',
  'داخل',
  'خارج',
  'أمام',
  'خلف',
  'تحت',
  'فوق',
  'بين',
  'حول',
  'ثم',
  'بعد',
  'قبل',
  'عندما',
  'بينما',
  'مع',
  'وهو',
  'وهي',
  'حتى',
])

export const CONVERSATIONAL_STARTS = [
  'ليه',
  'مين',
  'فين',
  'إمتى',
  'ازاي',
  'كام',
  'أنا',
  'انا',
  'إنت',
  'انت',
  'إنتي',
  'انتي',
  'احنا',
  'يا',
  'بس',
  'طب',
  'ما',
  'مش',
  'لا',
  'أيوه',
  'طيب',
  'خلاص',
  'يلا',
  'هو',
  'هي',
  'دي',
  'ده',
]

export const CONVERSATIONAL_MARKERS_RE =
  /\b(ده|دي|كده|عشان|علشان|عايز|عايزة|مش|هو|هي|احنا)\b/

export const VOCATIVE_RE = /\bيا\s+[\u0600-\u06FF]+/
export const VOCATIVE_TITLES_RE =
  /يا\s*([أا]خي|[أا]ختي|[يأ]اسطى|باشا|بيه|هانم|مدام|أستاذ|ياعم|ياواد|يابنت)/

export const QUOTE_MARKS_RE = /["«»]/

export const ACTION_VERB_FOLLOWED_BY_NAME_AND_VERB_RE =
  /^[يتنأ][\u0600-\u06FF]{2,}\s+[\u0600-\u06FF]+\s+و\s+[يتنأ][\u0600-\u06FF]{2,}/

export const THEN_ACTION_RE = /^ثم\s+[يتنأ][\u0600-\u06FF]{2,}/

export const BASMALA_BASM_RE = /بسم/i
export const BASMALA_ALLAH_RE = /الله/i
export const BASMALA_RAHMAN_RE = /الرحمن/i
export const BASMALA_RAHIM_RE = /الرحيم/i

export const PARENTHETICAL_RE = /^[\(（].*?[\)）]$/

export const INLINE_DIALOGUE_GLUE_RE =
  /^([\u0600-\u06FF]+[اً])([\u0600-\u06FF][\u0600-\u06FF\s]{0,20}?)\s*[:：]\s*(.+)$/

export const INLINE_DIALOGUE_RE = /^([^:：]{1,60}?)\s*[:：]\s*(.+)$/

export const ARABIC_ONLY_WITH_NUMBERS_RE =
  /^[\s\u0600-\u06FF\d٠-٩\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+$/
