const messages = {
  ar: {
    brand: "DDF Tracking", subtitle: "DAL Food · ضمان الجودة", language: "English", languageLabel: "التبديل إلى الإنجليزية",
    loading: "جارٍ تحميل DDF Tracking…", signIn: "دخول", email: "البريد الإلكتروني", password: "كلمة المرور",
    signInTitle: "تسجيل الدخول", adminCreates: "الحسابات ينشئها مدير النظام فقط. إذا احتجت دعوة أو نسيت كلمة المرور، تواصل مع المدير.",
    noOpenSignup: "الدخول بدعوة من مدير النظام فقط.", firstAdmin: "إعداد المدير الأول", setupTitle: "إعداد آمن لمرة واحدة",
    setupHelp: "أدخل رمز تهيئة المدير الذي أنشأه مالك المشروع، ثم بيانات المدير. لا يمكن إنشاء مدير آخر من هذه الصفحة بعد إتمام الإعداد.",
    bootstrapToken: "رمز تهيئة المدير", fullName: "الاسم الكامل", createAdmin: "إنشاء حساب المدير",
    reports: "التقارير", newReport: "تقرير جديد", invitations: "إدارة الدعوات", logout: "تسجيل الخروج",
    allReports: "تقارير ضمان الجودة", reportsHelp: "التقارير متاحة للقراءة لجميع المستخدمين النشطين.",
    pagination: "صفحات التقارير", previous: "السابق", next: "التالي", page: "صفحة", reportCount: "عدد التقارير",
    reportNumber: "رقم التقرير", date: "التاريخ", department: "الموقع / القسم", productBatch: "المنتج / رقم التشغيلة",
    issueType: "نوع الحالة", description: "وصف الملاحظة", correctiveAction: "الإجراء المتخذ", attachments: "المرفقات",
    author: "أُنشئ بواسطة", createdAt: "تاريخ الإنشاء", updatedAt: "آخر تحديث", createReport: "إنشاء تقرير",
    saveChanges: "حفظ التعديلات", edit: "تعديل التقرير", delete: "حذف التقرير", cancel: "إلغاء", back: "رجوع إلى التقارير",
    editOwnerOnly: "يمكن لصاحب التقرير أو المدير تعديله.", deleteAdminOnly: "الحذف متاح لمدير النظام فقط.",
    noReports: "لا توجد تقارير بعد.", noAttachments: "لا توجد مرفقات.", chooseFiles: "اختر مرفقات (حد أقصى 5 ملفات، 10 MB لكل ملف)",
    allowedFiles: "PDF وPNG وJPG وCSV وXLSX", uploadFiles: "إضافة الملفات", download: "تنزيل", reportSaved: "تم حفظ التقرير.",
    createInvitation: "إنشاء دعوة", invitationHelp: "أنشئ دعوة لحساب جديد أو لإعادة تعيين كلمة المرور، ثم أرسل الرابط والرمز يدوياً. الدعوة صالحة مرة واحدة لمدة 24 ساعة.",
    inviteLink: "رابط الدعوة", inviteCode: "رمز الدخول المؤقت", copyInvite: "نسخ الرابط والرمز", copied: "تم النسخ.",
    invitationCreated: "تم إصدار الدعوة. أرسل الرابط والرمز للمستخدم، وسيختفي الرمز بعد مغادرة هذه الصفحة.",
    pendingInvitations: "الدعوات الأخيرة", expiresAt: "ينتهي في", invitationStatus: "الحالة", pending: "بانتظار الاستخدام",
    used: "مستخدمة", revoked: "ملغاة", expired: "منتهية", revoke: "إلغاء الدعوة", noInvitations: "لا توجد دعوات.",
    invitationType: "نوع الدعوة", newAccount: "حساب جديد", resetPassword: "إعادة تعيين كلمة المرور", inviteNameHelp: "يُستخدم الاسم للحساب الجديد فقط.",
    resetPasswordHelp: "اختر كلمة مرور جديدة. سيتم إنهاء الجلسات الحالية لهذا الحساب.",
    acceptInvitation: "قبول الدعوة", invitedAs: "الدعوة مخصصة إلى", accessCode: "رمز الدعوة", setPassword: "أنشئ كلمة مرور",
    confirmPassword: "تأكيد كلمة المرور", activateAccount: "تفعيل الحساب", passwordRule: "استخدم 12 حرفاً على الأقل.",
    invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.", invalidInvitation: "الدعوة غير صحيحة أو منتهية أو سبق استخدامها.",
    setupNotConfigured: "إعداد المدير الأول غير متاح حالياً. تواصل مع مالك النظام.",
    bootstrapInvalid: "رمز التهيئة غير صحيح.", setupExists: "تم إعداد مدير النظام بالفعل.",
    csrfInvalid: "انتهت الجلسة الآمنة. حدّث الصفحة وحاول مجدداً.", loginRateLimited: "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً.",
    inviteRateLimited: "محاولات كثيرة لفتح الدعوة. انتظر قليلاً.", reportNotFound: "التقرير غير موجود.",
    reportEditForbidden: "لا يمكنك تعديل هذا التقرير. التعديل لصاحبه أو للمدير فقط.", adminRequired: "هذه الصفحة متاحة لمدير النظام فقط.",
    emailAlreadyRegistered: "هذا البريد لديه حساب بالفعل.", accountNotFound: "لا يوجد حساب فعال بهذا البريد.", attachmentTooLarge: "حجم الملف أكبر من 10 MB.",
    attachmentTypeNotAllowed: "الملف غير مدعوم. استخدم PDF أو PNG أو JPG أو CSV أو XLSX.",
    attachmentLimitReached: "الحد الأقصى خمسة مرفقات لكل تقرير.", attachmentUnavailable: "تعذر تنزيل المرفق حالياً.",
    rateLimited: "طلبات كثيرة. انتظر قليلاً ثم حاول مجدداً.", networkError: "تعذر الاتصال بالخادم. تحقق من الاتصال وحاول مجدداً.",
    genericError: "تعذر إكمال الطلب. حاول لاحقاً.", invalidFields: "راجع الحقول المطلوبة ثم حاول مجدداً.", reportDeleted: "تم حذف التقرير.",
    inviteCodeSent: "أرسل الرابط والرمز كلٌّ على حدة قدر الإمكان.", deleteConfirm: "هل تريد حذف هذا التقرير؟ لن يظهر للمستخدمين بعد الحذف.",
    revokeConfirm: "هل تريد إلغاء هذه الدعوة؟", invited: "مدعو", roleAdmin: "مدير", roleUser: "مستخدم",
    account: "الحساب", shareReport: "شارك التقرير مع فريق الجودة.", nameRequired: "أدخل الاسم الكامل.",
  },
  en: {
    brand: "DDF Tracking", subtitle: "DAL Food · Quality Assurance", language: "العربية", languageLabel: "Switch to Arabic",
    loading: "Loading DDF Tracking…", signIn: "Sign in", email: "Email address", password: "Password",
    signInTitle: "Sign in", adminCreates: "Accounts are created by the administrator. Contact the administrator for an invitation or if you forget your password.",
    noOpenSignup: "Access is by administrator invitation only.", firstAdmin: "First administrator setup", setupTitle: "One-time secure setup",
    setupHelp: "Enter the administrator setup token supplied by the project owner, then create the first administrator. This page cannot create another administrator after setup.",
    bootstrapToken: "Administrator setup token", fullName: "Full name", createAdmin: "Create administrator",
    reports: "Reports", newReport: "New report", invitations: "Manage invitations", logout: "Sign out",
    allReports: "Quality assurance reports", reportsHelp: "Reports can be read by all active users.",
    pagination: "Report pages", previous: "Previous", next: "Next", page: "Page", reportCount: "Report count",
    reportNumber: "Report number", date: "Date", department: "Site / department", productBatch: "Product / batch number",
    issueType: "Case type", description: "Observation", correctiveAction: "Action taken", attachments: "Attachments",
    author: "Created by", createdAt: "Created", updatedAt: "Last updated", createReport: "Create report",
    saveChanges: "Save changes", edit: "Edit report", delete: "Delete report", cancel: "Cancel", back: "Back to reports",
    editOwnerOnly: "Only the report author or an administrator can edit it.", deleteAdminOnly: "Only an administrator can delete reports.",
    noReports: "There are no reports yet.", noAttachments: "No attachments.", chooseFiles: "Choose attachments (up to 5 files, 10 MB each)",
    allowedFiles: "PDF, PNG, JPG, CSV, XLSX", uploadFiles: "Add files", download: "Download", reportSaved: "Report saved.",
    createInvitation: "Create invitation", invitationHelp: "Issue an invitation for a new account or a password reset, then send the link and code manually. It is single-use and expires after 24 hours.",
    inviteLink: "Invitation link", inviteCode: "Temporary access code", copyInvite: "Copy link and code", copied: "Copied.",
    invitationCreated: "Invitation issued. Send both the link and code; the code will disappear when you leave this page.",
    pendingInvitations: "Recent invitations", expiresAt: "Expires", invitationStatus: "Status", pending: "Pending",
    used: "Used", revoked: "Revoked", expired: "Expired", revoke: "Revoke invitation", noInvitations: "No invitations.",
    invitationType: "Invitation type", newAccount: "New account", resetPassword: "Reset password", inviteNameHelp: "Used for new accounts only.",
    resetPasswordHelp: "Choose a new password. Existing sessions for this account will be signed out.",
    acceptInvitation: "Accept invitation", invitedAs: "Invitation for", accessCode: "Invitation code", setPassword: "Create a password",
    confirmPassword: "Confirm password", activateAccount: "Activate account", passwordRule: "Use at least 12 characters.",
    invalidCredentials: "The email or password is incorrect.", invalidInvitation: "This invitation is invalid, expired, or already used.",
    setupNotConfigured: "First administrator setup is currently unavailable. Contact the system owner.",
    bootstrapInvalid: "The setup token is incorrect.", setupExists: "An administrator has already been set up.",
    csrfInvalid: "The secure session expired. Refresh the page and try again.", loginRateLimited: "Too many attempts. Wait a little and try again.",
    inviteRateLimited: "Too many invitation attempts. Wait a little.", reportNotFound: "Report not found.",
    reportEditForbidden: "You cannot edit this report. Only its author or an administrator may do so.", adminRequired: "This page is available to administrators only.",
    emailAlreadyRegistered: "This email already has an account.", accountNotFound: "No active account was found for this email.", attachmentTooLarge: "The file is larger than 10 MB.",
    attachmentTypeNotAllowed: "Unsupported file. Use PDF, PNG, JPG, CSV, or XLSX.",
    attachmentLimitReached: "A report can have up to five attachments.", attachmentUnavailable: "The attachment could not be downloaded right now.",
    rateLimited: "Too many requests. Wait and try again.", networkError: "Could not reach the server. Check the connection and try again.",
    genericError: "The request could not be completed. Try again later.", invalidFields: "Check the required fields and try again.", reportDeleted: "The report was deleted.",
    inviteCodeSent: "If possible, send the link and access code separately.", deleteConfirm: "Delete this report? It will no longer appear to users.",
    revokeConfirm: "Revoke this invitation?", invited: "Invited", roleAdmin: "Administrator", roleUser: "User",
    account: "Account", shareReport: "Share the report with the quality team.", nameRequired: "Enter the full name.",
  },
};

export function getLanguage() {
  try {
    return localStorage.getItem("ddf-language") === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function setLanguage(language) {
  const selected = language === "en" ? "en" : "ar";
  try { localStorage.setItem("ddf-language", selected); } catch { /* storage can be disabled */ }
  document.documentElement.lang = selected;
  document.documentElement.dir = selected === "ar" ? "rtl" : "ltr";
  return selected;
}

export function t(key, language = getLanguage()) {
  return messages[language]?.[key] ?? messages.en[key] ?? key;
}
