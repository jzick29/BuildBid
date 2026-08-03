import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/payment-success")({
  component: PaymentSuccessPage,
});

function PaymentSuccessPage() {
  return (
    <div className="max-w-md mx-auto p-6 text-center py-16">
      <div className="text-5xl mb-4">✅</div>
      <h1 className="text-2xl font-bold mb-2">Payment Confirmed!</h1>
      <p className="text-gray-500 mb-6">Your payment has been processed successfully.</p>
      <a href="/dashboard" className="px-6 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 inline-block">
        Back to Dashboard
      </a>
    </div>
  );
}
