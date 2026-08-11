import { Suspense } from 'react';
import DetailClient from './DetailClient';

export function generateStaticParams() {
  return [];
}

export default async function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DetailClient patientId={id} />
    </Suspense>
  );
}
