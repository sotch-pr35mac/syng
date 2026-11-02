//! Unlinked survey wire contract; keep Syng and Syrver copies identical.
use serde::{Deserialize, Serialize};
#[derive(Clone, Deserialize, Serialize, PartialEq, Eq, Default)]
#[serde(deny_unknown_fields)]
pub struct SurveyAnswers {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub learning_context: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub goals: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discovery_source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub learning_context_other: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub goals_other: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discovery_source_other: Option<String>,
}
#[derive(Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SurveyResponse {
    pub submission_id: String,
    pub schema_version: u32,
    pub revision: u32,
    pub answers: SurveyAnswers,
}
impl SurveyAnswers {
    pub fn validate(&mut self) -> bool {
        let learning_context_options = [
            "school_or_university_classes",
            "intensive_or_study_abroad_program",
            "tutor_or_private_lessons",
            "independent_study",
            "work_or_everyday_life",
            "just_exploring",
            "something_else",
        ];
        let goals_options = [
            "look_up_words",
            "support_my_classes",
            "read_chinese",
            "build_vocabulary",
            "prepare_for_exams",
            "practice_pronunciation",
            "practice_handwriting",
            "use_chinese_day_to_day",
            "something_else",
        ];
        let discovery_source_options = [
            "teacher_tutor_or_language_program",
            "friend_family_member_or_classmate",
            "search_engine",
            "app_store",
            "social_media",
            "online_community_or_forum",
            "github",
            "website_blog_or_newsletter",
            "somewhere_else",
            "i_don_t_remember",
        ];
        if self
            .learning_context
            .as_ref()
            .is_some_and(|value| !learning_context_options.contains(&value.as_str()))
            || self
                .discovery_source
                .as_ref()
                .is_some_and(|value| !discovery_source_options.contains(&value.as_str()))
            || self
                .goals
                .iter()
                .any(|value| !goals_options.contains(&value.as_str()))
        {
            return false;
        }
        self.goals.sort();
        if self.goals.windows(2).any(|values| values[0] == values[1]) {
            return false;
        }
        if !normalize_other(
            &mut self.learning_context_other,
            self.learning_context.as_deref() == Some("something_else"),
        ) || !normalize_other(
            &mut self.goals_other,
            self.goals.iter().any(|goal| goal == "something_else"),
        ) || !normalize_other(
            &mut self.discovery_source_other,
            self.discovery_source.as_deref() == Some("somewhere_else"),
        ) {
            return false;
        }
        self.learning_context.is_some() || self.discovery_source.is_some() || !self.goals.is_empty()
    }
}
// Match HTML maxlength's UTF-16 units so emoji and supplementary characters have
// the same limit in the webview and at both native/service trust boundaries.
fn normalize_other(value: &mut Option<String>, selected: bool) -> bool {
    let Some(text) = value else {
        return true;
    };
    if text.chars().any(char::is_control) {
        return false;
    }
    let trimmed = text.trim();
    if trimmed.is_empty() {
        *value = None;
        return true;
    }
    if !selected || trimmed.encode_utf16().count() > 200 {
        return false;
    }
    *text = trimmed.to_owned();
    true
}
impl SurveyResponse {
    pub fn validate(&mut self) -> bool {
        self.schema_version == 1
            && self.revision > 0
            && uuid::Uuid::parse_str(&self.submission_id)
                .is_ok_and(|value| value.get_version_num() == 4)
            && self.answers.validate()
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn other_answers_are_optional_trimmed_and_bound_to_their_choices() {
        let mut answers = SurveyAnswers {
            learning_context: Some("something_else".into()),
            goals: vec!["something_else".into()],
            discovery_source: Some("somewhere_else".into()),
            learning_context_other: Some("  中文课程  ".into()),
            goals_other: Some("   ".into()),
            discovery_source_other: Some(" A newsletter ".into()),
        };
        assert!(answers.validate());
        assert_eq!(answers.learning_context_other.as_deref(), Some("中文课程"));
        assert!(answers.goals_other.is_none());
        assert_eq!(
            answers.discovery_source_other.as_deref(),
            Some("A newsletter")
        );
        answers.learning_context = Some("independent_study".into());
        assert!(!answers.validate());
        answers.learning_context_other = None;
        answers.goals.clear();
        answers.goals_other = Some("Speaking".into());
        assert!(!answers.validate());
        answers.goals_other = None;
        answers.discovery_source = None;
        assert!(!answers.validate());
    }
    #[test]
    fn other_text_limits_match_utf16_and_reject_control_characters() {
        let mut answers = SurveyAnswers {
            goals: vec!["something_else".into()],
            ..Default::default()
        };
        for text in ["字".repeat(200), "😀".repeat(100)] {
            answers.goals_other = Some(text);
            assert!(answers.validate());
        }
        for text in [
            "字".repeat(201),
            "😀".repeat(101),
            "private\ntext".into(),
            "\0".into(),
            "\t".into(),
        ] {
            answers.goals_other = Some(text);
            assert!(!answers.validate());
        }
    }
    #[test]
    fn rejects_empty_unknown_and_duplicate_answers() {
        assert!(!SurveyAnswers::default().validate());
        assert!(serde_json::from_str::<SurveyAnswers>(r#"{"device_id":"private"}"#).is_err());
        let mut answers = SurveyAnswers {
            goals: vec!["read_chinese".into()],
            ..Default::default()
        };
        assert!(answers.validate());
        answers.goals.push("read_chinese".into());
        assert!(!answers.validate());
    }
}
