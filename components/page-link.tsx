import type {ComponentProps} from "react";

// Use native navigation: the current Vinext beta's production RSC Link throws
// during prefetch and click. A real href also works before hydration or without JS.
export default function PageLink(props:ComponentProps<"a">) {return <a {...props}/>}
