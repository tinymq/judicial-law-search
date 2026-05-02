export const FEEDBACK_ISSUE_TYPES = [
  '数据错误',
  '内容缺失',
  '格式问题',
  '条款错误',
  '其他',
] as const;

export const FEEDBACK_STATUS_OPTIONS = [
  '待处理',
  '处理中',
  '已解决',
  '已忽略',
] as const;

export type FeedbackIssueType = (typeof FEEDBACK_ISSUE_TYPES)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUS_OPTIONS)[number];
