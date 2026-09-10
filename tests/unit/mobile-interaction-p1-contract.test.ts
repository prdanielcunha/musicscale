import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), 'utf8');

describe('mobile interaction P1 contract', () => {
  it('isolates the mobile drawer state from AppLayout and the active route tree', () => {
    const app = read('PrivateApp.tsx');
    const drawer = read('components/layout/MobileSidebarDrawer.tsx');

    expect(app).toContain('MobileSidebarDrawerHandle');
    expect(app).toContain('<MobileSidebarDrawer ref={mobileSidebarRef} />');
    expect(app).toContain('isMobileViewport ?');
    expect(app).not.toContain('Mobile Sidebar Overlay');

    expect(drawer).toContain('const [isOpen, setIsOpen] = useState(false)');
    expect(drawer).toContain('useImperativeHandle');
    expect(drawer).toContain('isCollapsed={false}');
    expect(drawer).toContain('ExpandedMobileSidebar = memo');
  });

  it('does not fire the mobile menu action twice for a single touch', () => {
    const header = read('components/layout/Header.tsx');

    expect(header).toContain('onClick={onMenuClick}');
    expect(header).not.toContain('onPointerDown={(event)');
  });

  it('keeps capability resolution stable across navigation renders', () => {
    const capability = read('hooks/useCapability.ts');

    expect(capability).toContain('useMemo');
    expect(capability).toContain('canonicalCapabilitiesFromContext(context)');
    expect(capability).toContain('useCallback');
    expect(capability).toContain('const hasCapability = useCallback');
  });

  it('does not replay historical pending notifications as bootstrap toasts', () => {
    const notifications = read('contexts/NotificationContext.tsx');

    expect(notifications).toContain('seenNotificationIdsRef');
    expect(notifications).toContain('listenerStartedAtRef');
    expect(notifications).toContain('const isFresh =');
    expect(notifications).toContain('!wasAlreadySeen && !data.isRead && isFresh');
    expect(notifications).toContain('id: `notification:${notif.id}`');
  });

  it('keeps transient alerts bounded and always dismissible', () => {
    const toasts = read('contexts/ToastContext.tsx');

    expect(toasts).toContain('.slice(-4)');
    expect(toasts).toMatch(/aria-label=\{t\(["']common\.close["'], ["']Fechar["']\)\}/);
    expect(toasts).not.toContain('toastItem.type !== "feedback" &&');
    expect(toasts).toContain('onClick={() => removeToast(toastItem.id)}');
  });
});
