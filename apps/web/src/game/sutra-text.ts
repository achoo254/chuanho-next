/**
 * Public-domain scripture for the chanting screen (Tụng kinh), word for word as published (the opening of the Heart Sutra in
 * Sino-Vietnamese, then the Amitabha recitation). Never edited, extended or generated: wrong scripture hurts people.
 */

const HEART_SUTRA_OPENING =
  'Quán Tự Tại Bồ Tát, hành thâm Bát Nhã Ba La Mật Đa thời, chiếu kiến ngũ uẩn giai không, độ nhất thiết khổ ách. ' +
  'Xá Lợi Tử, sắc bất dị không, không bất dị sắc, sắc tức thị không, không tức thị sắc, thọ tưởng hành thức, diệc phục như thị.';

const AMITABHA_RECITATION = 'Nam mô A Di Đà Phật';
/** How many times the recitation repeats after the sutra. */
const RECITATION_REPEATS = 3;

/** One line on screen: its words (syllables), each lit by one strike of the wooden bell. */
export interface SutraLine {
  readonly words: readonly string[];
}

/** Splits text into lines at commas and full stops, keeping the punctuation on the line's last word. */
function toLines(text: string): SutraLine[] {
  return (text.match(/[^,.]+[,.]?/g) ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => ({ words: line.split(/\s+/) }));
}

export const SUTRA_LINES: readonly SutraLine[] = [
  ...toLines(HEART_SUTRA_OPENING),
  ...Array.from({ length: RECITATION_REPEATS }, (): SutraLine => ({ words: AMITABHA_RECITATION.split(' ') })),
];

/** Total strikes to finish the text. */
export const SUTRA_WORD_COUNT = SUTRA_LINES.reduce((sum, line) => sum + line.words.length, 0);
