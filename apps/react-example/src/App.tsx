import { NativeExample } from "./examples/native/NativeExample";
import { SubformExample } from "./examples/native/SubformExample";

export default function App() {
  return (
    <main className="page">
      <header className="page__head">
        <h1>@x-ac/design 三包用法示例</h1>
        <p>
          本页基于 <code>@x-ac/design-core</code> + <code>@x-ac/design-react</code>，注册了 3 个零依赖原生组件，
          演示「Schema 驱动渲染 + 数据双向绑定 + 事件通知 + Schema 导出」。
        </p>
      </header>

      <NativeExample />

      <SubformExample />

      <footer className="page__foot">
        <p>另见 <a href="../">Vue 版示例（@x-ac/design-vue）</a>。</p>
      </footer>
    </main>
  );
}
