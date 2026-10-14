import type {Metadata} from 'next';
import './globals.css';
import './intelligence.css';
export const metadata:Metadata={title:'GharBox · A smarter way to care for home',description:'Thoughtfully planned groceries, for the people you call home.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}

