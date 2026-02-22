/**
 * @description نقطة التجميع (Barrel file) لمجلد الخطافات والدوال المساعدة الخاصة بالحالة الجانبية مثل التخزين والتاريخ والإشعارات.
 */
export { useIsMobile, subscribeIsMobile } from './use-mobile'
export { useToast, toast, subscribeToastState, dismissToast } from './use-toast'
export { useHistory } from './use-history'
export { useAutoSave, loadFromStorage, saveToStorage } from './use-local-storage'
