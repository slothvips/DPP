import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { KeepAliveTabPanel } from './KeepAliveTabPanel';

interface LazyTabPanelProps {
  active: boolean;
  visible: boolean;
  fallback: ReactNode;
  children: ReactNode;
}

/**
 * 懒加载 + KeepAlive 标签页面板
 *
 * 与 KeepAliveTabPanel 的区别:
 * - KeepAliveTabPanel:始终渲染 children(用于同步导入的轻量视图)
 * - LazyTabPanel:首次激活才渲染 children(用于 React.lazy 包裹的重型视图)
 *
 * 工作流程:
 * 1. 初始状态:不渲染 children(React.lazy 不会触发动态 import)
 * 2. 首次 active && visible:标记为已激活,渲染 Suspense + children,
 *    React.lazy 触发动态 import,加载期间显示 fallback
 * 3. 加载完成:显示真实内容
 * 4. 之后切换到其他 tab:children 保持挂载(keep-alive),仅 visibility 隐藏
 *
 * 这样真正实现了延迟加载:用户不打开某 tab,该 tab 的代码(Monaco 等)就不会被下载。
 */
export function LazyTabPanel({ active, visible, fallback, children }: LazyTabPanelProps) {
  const [everActivated, setEverActivated] = useState(false);

  useEffect(() => {
    if (active && visible) {
      setEverActivated(true);
    }
  }, [active, visible]);

  return (
    <KeepAliveTabPanel active={active} visible={visible}>
      {everActivated ? <Suspense fallback={fallback}>{children}</Suspense> : null}
    </KeepAliveTabPanel>
  );
}
