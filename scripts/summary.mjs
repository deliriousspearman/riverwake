// Card and list labels.

/** "4 lessons" (or "1 lesson"). */
export const lessonSummary = (lessons) => `${lessons.length} ${lessons.length === 1 ? 'lesson' : 'lessons'}`;

/** What the catalogue filter matches a card against: title and description. */
export const filterText = (data) => `${data.title} ${data.description ?? ''}`.toLowerCase().trim();

/** First letter a term is filed under on /glossary/: A–Z, or "#" for anything else. */
export const letterOf = (term) => {
	const letter = term.trim().charAt(0).toUpperCase();
	return /[A-Z]/.test(letter) ? letter : '#';
};
