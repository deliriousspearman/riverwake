// Quiz answers (src/client/quiz.ts), remembered in this browser so a learner coming back to a page
// sees what they answered, marked right or wrong, until they choose "Try again". Stored only in
// localStorage, like progress (src/lib/progress.ts: "Reset progress" clears them and backups carry
// them). Never rename the key.
//
//   lms-quiz-v1   { "<question id>": { answer: [option indexes], right: boolean, at: ms } }
//
// A question's id is a hash of its text, options and correct answers (scripts/blocks.mjs,
// questionId), so an answer is forgotten when an editor changes the question, rather than shown
// against different options. The same question on two pages shares its answer.

const KEY = 'lms-quiz-v1';

export type QuizAnswer = { answer: number[]; right: boolean; at: number };
export type QuizAnswers = Record<string, QuizAnswer>;

/** Whether `value` is a stored answer (backups and storage are checked, not trusted). */
export const isQuizAnswer = (value: unknown): value is QuizAnswer => {
	const a = value as QuizAnswer | null;
	return !!a && typeof a === 'object' && Array.isArray(a.answer) && a.answer.every((i) => Number.isInteger(i) && i >= 0) && typeof a.right === 'boolean' && Number.isFinite(a.at);
};

export function loadQuizAnswers(): QuizAnswers {
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? '{}');
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		return Object.fromEntries(Object.entries(parsed).filter(([, answer]) => isQuizAnswer(answer))) as QuizAnswers;
	} catch {
		return {};
	}
}

/** Saves all answers (an empty set removes the key). Storage unavailable: answers last for the page. */
export function saveQuizAnswers(answers: QuizAnswers) {
	try {
		if (Object.keys(answers).length) localStorage.setItem(KEY, JSON.stringify(answers));
		else localStorage.removeItem(KEY);
	} catch {
		// Nothing to do: the quiz still works on this page.
	}
}

export function rememberQuizAnswer(id: string, answer: number[], right: boolean) {
	saveQuizAnswers({ ...loadQuizAnswers(), [id]: { answer, right, at: Date.now() } });
}

export function forgetQuizAnswer(id: string) {
	const answers = loadQuizAnswers();
	if (!(id in answers)) return;
	delete answers[id];
	saveQuizAnswers(answers);
}

/** Adds a backup's answers to this browser's: an answer here is kept, a newer one replaces it. */
export function mergeQuizAnswers(saved: unknown) {
	if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
	const answers = loadQuizAnswers();
	for (const [id, answer] of Object.entries(saved)) {
		if (/^[0-9a-f]{6,64}$/.test(id) && isQuizAnswer(answer) && (!answers[id] || answers[id].at < answer.at)) answers[id] = answer;
	}
	saveQuizAnswers(answers);
}
