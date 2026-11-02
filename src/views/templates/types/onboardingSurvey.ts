/** Versioned survey choices and optional Other details. Labels never serve as wire identifiers. */
export const SURVEY_SCHEMA_VERSION = 1;
export const SURVEY_OTHER_MAX_LENGTH = 200;
export interface SurveyAnswers {
	learning_context?: string;
	goals?: string[];
	discovery_source?: string;
	learning_context_other?: string;
	goals_other?: string;
	discovery_source_other?: string;
}
export const SURVEY_QUESTIONS = [
	{
		key: 'learning_context',
		title: 'How are you currently learning Chinese?',
		helper: 'Choose the closest match.',
		options: [
			{
				id: 'school_or_university_classes',
				label: 'School or university classes',
			},
			{
				id: 'intensive_or_study_abroad_program',
				label: 'Intensive or study-abroad program',
			},
			{
				id: 'tutor_or_private_lessons',
				label: 'Tutor or private lessons',
			},
			{
				id: 'independent_study',
				label: 'Independent study',
			},
			{
				id: 'work_or_everyday_life',
				label: 'Work or everyday life',
			},
			{
				id: 'just_exploring',
				label: 'Just exploring',
			},
			{
				id: 'something_else',
				label: 'Something else',
			},
		],
	},
	{
		key: 'goals',
		title: 'What would you like Syng to help you do?',
		helper: 'Choose all that apply.',
		options: [
			{
				id: 'look_up_words',
				label: 'Look up words',
			},
			{
				id: 'support_my_classes',
				label: 'Support my classes',
			},
			{
				id: 'read_chinese',
				label: 'Read Chinese',
			},
			{
				id: 'build_vocabulary',
				label: 'Build vocabulary',
			},
			{
				id: 'prepare_for_exams',
				label: 'Prepare for exams',
			},
			{
				id: 'practice_pronunciation',
				label: 'Practice pronunciation',
			},
			{
				id: 'practice_handwriting',
				label: 'Practice handwriting',
			},
			{
				id: 'use_chinese_day_to_day',
				label: 'Use Chinese day to day',
			},
			{
				id: 'something_else',
				label: 'Something else',
			},
		],
	},
	{
		key: 'discovery_source',
		title: 'How did you first hear about Syng?',
		helper: '',
		options: [
			{
				id: 'teacher_tutor_or_language_program',
				label: 'Teacher, tutor, or language program',
			},
			{
				id: 'friend_family_member_or_classmate',
				label: 'Friend, family member, or classmate',
			},
			{
				id: 'search_engine',
				label: 'Search engine',
			},
			{
				id: 'app_store',
				label: 'App store',
			},
			{
				id: 'social_media',
				label: 'Social media',
			},
			{
				id: 'online_community_or_forum',
				label: 'Online community or forum',
			},
			{
				id: 'github',
				label: 'GitHub',
			},
			{
				id: 'website_blog_or_newsletter',
				label: 'Website, blog, or newsletter',
			},
			{
				id: 'somewhere_else',
				label: 'Somewhere else',
			},
			{
				id: 'i_don_t_remember',
				label: 'I don’t remember',
			},
		],
	},
] as const;
export function hasSurveyAnswers(answers: SurveyAnswers): boolean {
	return Boolean(answers.learning_context || answers.goals?.length || answers.discovery_source);
}
