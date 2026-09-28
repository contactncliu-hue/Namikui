export type LanguageCode = 'en' | 'vi' | 'zh' | 'pt' | 'ar' | 'ko' | 'es';

type TranslationEntry = Record<LanguageCode, string>;

// Only UI copy goes here — never member names, event names, dates,
// percentages, or anything that comes from data. Add one entry per
// string as we migrate each file.
export const translations = {
  homepage: {
    en: 'HOMEPAGE', vi: 'TRANG CHỦ', zh: '首页', pt: 'PÁGINA INICIAL',
    ar: 'الصفحة الرئيسية', ko: '홈페이지', es: 'INICIO',
  },
  notice: {
    en: 'NOTICE', vi: 'THÔNG BÁO', zh: '公告', pt: 'AVISO',
    ar: 'إشعار', ko: '공지사항', es: 'AVISO',
  },
  members: {
    en: 'MEMBERS', vi: 'THÀNH VIÊN', zh: '成员', pt: 'MEMBROS',
    ar: 'الأعضاء', ko: '멤버', es: 'MIEMBROS',
  },
  blackGold: {
    en: 'BLACK GOLD', vi: 'BLACK GOLD', zh: '黑金', pt: 'BLACK GOLD',
    ar: 'بلاك غولد', ko: '블랙골드', es: 'BLACK GOLD',
  },
  eventAttendance: {
    en: 'EVENT ATTENDANCE', vi: 'ĐIỂM DANH SỰ KIỆN', zh: '活动出席', pt: 'PRESENÇA NO EVENTO',
    ar: 'حضور الفعاليات', ko: '이벤트 출석', es: 'ASISTENCIA AL EVENTO',
  },
  vsPoints: {
    en: 'VS POINTS', vi: 'ĐIỂM VS', zh: 'VS积分', pt: 'PONTOS VS',
    ar: 'نقاط VS', ko: 'VS 포인트', es: 'PUNTOS VS',
  },
  managementAdmin: {
    en: 'MANAGEMENT & ADMIN', vi: 'QUẢN LÝ & QUẢN TRỊ', zh: '管理与后台', pt: 'GESTÃO E ADMIN',
    ar: 'الإدارة والتحكم', ko: '관리 및 운영', es: 'GESTIÓN Y ADMIN',
  },
  discussionRoom: {
    en: 'DISCUSSION ROOM', vi: 'PHÒNG THẢO LUẬN', zh: '讨论室', pt: 'SALA DE DISCUSSÃO',
    ar: 'غرفة النقاش', ko: '토론방', es: 'SALA DE DISCUSIÓN',
  },
  editHistoryAudit: {
    en: 'EDIT HISTORY & AUDIT', vi: 'LỊCH SỬ CHỈNH SỬA', zh: '编辑历史与审计', pt: 'HISTÓRICO E AUDITORIA',
    ar: 'سجل التعديلات والتدقيق', ko: '편집 기록 및 감사', es: 'HISTORIAL Y AUDITORÍA',
  },
  assignUserRoles: {
    en: 'ASSIGN USER ROLES', vi: 'PHÂN QUYỀN NGƯỜI DÙNG', zh: '分配用户角色', pt: 'ATRIBUIR FUNÇÕES',
    ar: 'تعيين أدوار المستخدمين', ko: '사용자 역할 지정', es: 'ASIGNAR ROLES',
  },
  logOut: {
    en: 'LOG OUT', vi: 'ĐĂNG XUẤT', zh: '登出', pt: 'SAIR',
    ar: 'تسجيل الخروج', ko: '로그아웃', es: 'CERRAR SESIÓN',
  },
  role: {
    en: 'Role:', vi: 'Vai trò:', zh: '角色：', pt: 'Função:',
    ar: 'الدور:', ko: '역할:', es: 'Rol:',
  },
  toggleMenu: {
    en: 'Toggle menu', vi: 'Bật/tắt menu', zh: '切换菜单', pt: 'Alternar menu',
    ar: 'تبديل القائمة', ko: '메뉴 전환', es: 'Alternar menú',
  },
} satisfies Record<string, TranslationEntry>;

export type TranslationKey = keyof typeof translations;
