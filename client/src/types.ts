export type Role = 'student' | 'parent' | 'admin';
export type Lang = 'en' | 'ur';
export type Skill = 'colour' | 'light' | 'proportion' | 'composition';
export type Scores = Record<Skill, number>;

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string | null;
  username: string | null;
  birthYear: number | null;
  language: Lang;
  phone: string | null;
  status: 'active' | 'suspended';
  parentId: string | null;
  weeklyReport: boolean;
  shareTeacher: boolean;
  dailyLimitOn: boolean;
  dailyLimitMin: number;
  createdAt: string;
  lastActiveAt?: string | null;
}

export interface Me {
  user: User | null;
  parent?: { id: string; name: string } | null;
  unread?: number;
  minutesToday?: number;
  timeLimitReached?: boolean;
}

export interface Tip { area: Skill; x: number; y: number; en: string; ur: string; why?: { en: string; ur: string } }
export interface Drawing {
  id: string;
  userId: string;
  title: string;
  mode: 'paper' | 'screen';
  status: 'processing' | 'done' | 'failed' | 'rejected';
  error: string | null;
  provider: string | null;
  praise: { en: { title: string; text: string }; ur: { title: string; text: string } } | null;
  tips: Tip[];
  scores: Scores | null;
  exercise: { en: string; ur: string } | null;
  imageUrl: string;
  createdAt: string;
  analyzedAt: string | null;
}

export interface Lesson {
  id: string;
  slug: string;
  title: string;
  titleUr: string | null;
  category: 'light' | 'colour' | 'proportion' | 'composition' | 'perspective' | 'shapes';
  summary: string;
  summaryUr: string | null;
  durationMin: number;
  completed: boolean;
  steps: { en: string; ur?: string }[];
  stepCount: number;
}

export interface Challenge {
  id: string;
  title: string;
  titleUr: string | null;
  description: string;
  descriptionUr: string | null;
  prize: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  joined?: boolean;
  submitted?: boolean;
  period?: 'day' | 'week' | 'month';
}

export interface Badge { code: string; name: string; nameUr: string; color: string; icon: string; hint: string; earned: boolean; earnedAt: string | null }

export interface Notification { id: string; title: string; body: string; link: string | null; read: boolean; createdAt: string }
