// Knowledge checks rendered by the ```quiz blocks (scripts/blocks.mjs). Checked answers are
// remembered in this browser (src/lib/quiz-answers.ts, by each question's data-question id) and shown
// again, marked, when the page is next opened; "Try again" forgets them. Nothing is sent anywhere.
// It runs after every client-side navigation (Docusaurus doesn't reload pages), once per quiz.
import { forgetQuizAnswer, loadQuizAnswers, rememberQuizAnswer, type QuizAnswers } from '../lib/quiz-answers';
import { newElements } from './ready';

function setupQuestion(question: HTMLElement, saved: QuizAnswers, onChange: () => void) {
	const id = question.dataset.question;
	const inputs = [...question.querySelectorAll<HTMLInputElement>('input')];
	const button = question.querySelector<HTMLButtonElement>('[data-quiz-check]')!;
	const feedback = question.querySelector<HTMLElement>('.lms-quiz-feedback')!;
	const result = question.querySelector<HTMLElement>('.lms-quiz-result')!;
	const multiple = inputs[0]?.type === 'checkbox';

	const reset = () => {
		for (const input of inputs) {
			input.checked = false;
			input.disabled = false;
			input.closest('label')!.classList.remove('is-correct', 'is-wrong', 'is-missed');
		}
		question.classList.remove('is-answered', 'is-right', 'is-wrong');
		delete question.dataset.result;
		feedback.hidden = true;
		button.textContent = 'Check answer';
		button.disabled = true;
		if (id) forgetQuizAnswer(id);
		onChange();
	};

	const check = (remember = true) => {
		let right = true;
		for (const input of inputs) {
			const correct = input.hasAttribute('data-correct');
			const label = input.closest('label')!;
			input.disabled = true;
			if (correct && input.checked) label.classList.add('is-correct');
			else if (correct) (label.classList.add('is-missed'), (right = false));
			else if (input.checked) (label.classList.add('is-wrong'), (right = false));
		}
		question.classList.add('is-answered', right ? 'is-right' : 'is-wrong');
		question.dataset.result = right ? 'right' : 'wrong';
		result.textContent = right ? 'Correct!' : multiple ? 'Not quite. The correct answers are highlighted.' : 'Not quite. The correct answer is highlighted.';
		feedback.hidden = false;
		button.textContent = 'Try again';
		// A remembered answer is ticked by this script, without the change event that enables it.
		button.disabled = false;
		if (id && remember) rememberQuizAnswer(id, inputs.flatMap((input, i) => (input.checked ? [i] : [])), right);
		onChange();
	};

	for (const input of inputs) {
		input.addEventListener('change', () => {
			button.disabled = !inputs.some((i) => i.checked);
		});
	}
	button.addEventListener('click', () => (question.classList.contains('is-answered') ? reset() : check()));

	// A remembered answer: tick the same options and mark them, as if just checked. An answer that
	// doesn't fit the question's options (it shouldn't, as the id changes with them) is ignored.
	const answer = id ? saved[id] : undefined;
	if (answer && answer.answer.length && answer.answer.every((i) => i < inputs.length) && (multiple || answer.answer.length === 1)) {
		answer.answer.forEach((i) => (inputs[i].checked = true));
		check(false);
	}
}

function setup() {
	const quizzes = newElements('[data-quiz]');
	if (!quizzes.length) return;
	const saved = loadQuizAnswers();
	for (const quiz of quizzes) {
		const questions = [...quiz.querySelectorAll<HTMLElement>('[data-question]')];
		const score = quiz.querySelector<HTMLElement>('.lms-quiz-score')!;

		const updateScore = () => {
			const answered = questions.filter((q) => q.dataset.result);
			const right = answered.filter((q) => q.dataset.result === 'right').length;
			score.textContent = answered.length
				? `${right} of ${questions.length} correct${answered.length < questions.length ? ` (${questions.length - answered.length} left)` : ''}`
				: '';
			quiz.classList.toggle('is-complete', right === questions.length);
		};

		for (const question of questions) setupQuestion(question, saved, updateScore);
		updateScore();
	}
}

export function onRouteDidUpdate() {
	setup();
}
