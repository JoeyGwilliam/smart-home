/** A Mandarin word or short phrase, how to say it, and what it means in English. */
export interface MandarinWord {
  /** The word in simplified Chinese characters. */
  characters: string
  /** How the word is pronounced, in pinyin with tone marks. */
  pinyin: string
  translation: string
}

/** The Mandarin words that take turns as the Mandarin word of the day, in the order they are shown. */
export const MANDARIN_WORDS: MandarinWord[] = [
  { characters: '你好', pinyin: 'nǐ hǎo', translation: 'hello' },
  { characters: '谢谢', pinyin: 'xièxie', translation: 'thank you' },
  { characters: '朋友', pinyin: 'péngyou', translation: 'friend' },
  { characters: '月亮', pinyin: 'yuèliang', translation: 'moon' },
  { characters: '太阳', pinyin: 'tàiyáng', translation: 'sun' },
  { characters: '星星', pinyin: 'xīngxing', translation: 'star' },
  { characters: '下雨', pinyin: 'xià yǔ', translation: 'to rain' },
  { characters: '雪', pinyin: 'xuě', translation: 'snow' },
  { characters: '云', pinyin: 'yún', translation: 'cloud' },
  { characters: '风', pinyin: 'fēng', translation: 'wind' },
  { characters: '猫', pinyin: 'māo', translation: 'cat' },
  { characters: '狗', pinyin: 'gǒu', translation: 'dog' },
  { characters: '鸡', pinyin: 'jī', translation: 'chicken' },
  { characters: '羊', pinyin: 'yáng', translation: 'sheep' },
  { characters: '牛', pinyin: 'niú', translation: 'cow' },
  { characters: '茶', pinyin: 'chá', translation: 'tea' },
  { characters: '米饭', pinyin: 'mǐfàn', translation: 'cooked rice' },
  { characters: '饺子', pinyin: 'jiǎozi', translation: 'dumplings' },
  { characters: '好吃', pinyin: 'hǎochī', translation: 'delicious' },
  { characters: '漂亮', pinyin: 'piàoliang', translation: 'pretty' },
  { characters: '可爱', pinyin: 'kě’ài', translation: 'cute' },
  { characters: '喜欢', pinyin: 'xǐhuan', translation: 'to like' },
  { characters: '爱', pinyin: 'ài', translation: 'love' },
  { characters: '家', pinyin: 'jiā', translation: 'home; family' },
  { characters: '花', pinyin: 'huā', translation: 'flower' },
  { characters: '树', pinyin: 'shù', translation: 'tree' },
  { characters: '水', pinyin: 'shuǐ', translation: 'water' },
  { characters: '山', pinyin: 'shān', translation: 'mountain' },
  { characters: '开心', pinyin: 'kāixīn', translation: 'happy' },
  { characters: '加油', pinyin: 'jiāyóu', translation: 'keep going! (literally "add oil")' },
  { characters: '慢慢来', pinyin: 'mànmàn lái', translation: 'take your time' },
  { characters: '没关系', pinyin: 'méi guānxi', translation: 'it doesn’t matter; no worries' },
  { characters: '早上好', pinyin: 'zǎoshang hǎo', translation: 'good morning' },
  { characters: '晚安', pinyin: 'wǎn’ān', translation: 'good night' },
  { characters: '再见', pinyin: 'zàijiàn', translation: 'goodbye' },
  { characters: '今天', pinyin: 'jīntiān', translation: 'today' },
  { characters: '明天', pinyin: 'míngtiān', translation: 'tomorrow' },
  { characters: '天气', pinyin: 'tiānqì', translation: 'weather' },
  { characters: '彩虹', pinyin: 'cǎihóng', translation: 'rainbow' },
  { characters: '蝴蝶', pinyin: 'húdié', translation: 'butterfly' },
  { characters: '熊猫', pinyin: 'xióngmāo', translation: 'panda' },
  { characters: '辛苦了', pinyin: 'xīnkǔ le', translation: 'thank you for your hard work' },
]
