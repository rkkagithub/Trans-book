import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { UserPlus, Truck, FileText, IdCard } from "lucide-react";

export default function QuickActions() {
  const [, navigate] = useLocation();

  const actions = [
    {
      title: "Add Customer",
      description: "Create new customer profile",
      icon: UserPlus,
      color: "bg-blue-100 text-blue-600",
      action: () => navigate("/customers"),
    },
    {
      title: "Add Vehicle",
      description: "Register new vehicle",
      icon: Truck,
      color: "bg-green-100 text-green-600",
      action: () => navigate("/vehicles"),
    },
    {
      title: "Create Invoice",
      description: "Generate new invoice",
      icon: FileText,
      color: "bg-purple-100 text-purple-600",
      action: () => navigate("/invoices"),
    },
    {
      title: "Add Driver",
      description: "Register new driver",
      icon: IdCard,
      color: "bg-yellow-100 text-yellow-600",
      action: () => navigate("/drivers"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <Button
              key={index}
              variant="outline"
              className="w-full flex items-center p-4 text-left border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-colors h-auto"
              onClick={action.action}
            >
              <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mr-4`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">{action.title}</p>
                <p className="text-sm text-gray-600">{action.description}</p>
              </div>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
