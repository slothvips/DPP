/**
 * 控制台日志拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 尽量保留现场信息，同时限制克隆深度、节点数和字符串长度
 * 2. 对主世界完全无感知 - 任何异常都不能影响原始 console 行为
 * 3. 不产生副作用 - 序列化过程不触发 getter、不修改对象
 * 4. 可完全恢复 - 停止录制时能还原所有被修改的 console 方法
 */
import { installConsoleInterceptor } from './console-interceptor/install';

export default defineUnlistedScript(() => {
  const channelToken =
    document.currentScript instanceof HTMLScriptElement
      ? document.currentScript.dataset.dppChannelToken || ''
      : '';
  installConsoleInterceptor(channelToken);
});
