import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'LEO XI Clubhouse | Pro Clubs',description:'LEO XI Pro Clubs: gerçek EA verileriyle takım istatistikleri, oyuncu sıralaması ve son maçlar.',icons:{icon:'/leo-xi-logo.png'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="tr"><body>{children}</body></html>}
