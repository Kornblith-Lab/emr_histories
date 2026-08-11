export const metadata = {
  title: 'MedReview Pro',
  description: 'Clinical Worklist Evaluation Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}