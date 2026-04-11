/**
 * 控制台日志拦截脚本 - 注入到页面主世界执行
 * 此脚本会被打包为独立文件，通过 script 标签注入到页面
 *
 * 设计原则：
 * 1. 保证现场信息不丢失 - 完整深度克隆，无任何截断或限制
 * 2. 对主世界完全无感知 - 任何异常都不能影响原始 console 行为
 * 3. 不产生副作用 - 序列化过程不触发 getter、不修改对象
 * 4. 可完全恢复 - 停止录制时能还原所有被修改的 console 方法
 */
import { installConsoleInterceptor } from './console-interceptor/install';

export default defineUnlistedScript(() => {
  installConsoleInterceptor();
});
