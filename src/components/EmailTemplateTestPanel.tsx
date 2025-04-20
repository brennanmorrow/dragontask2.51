import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { EmailTemplateTestForm } from './EmailTemplateTestForm';
import { WelcomeEmailPreview } from './WelcomeEmailPreview';
import { NotificationEmailPreview } from './NotificationEmailPreview';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Mail, User, Bell, Clock, CheckCircle, Key, CheckSquare } from 'lucide-react';

export function EmailTemplateTestPanel() {
  const [activeTab, setActiveTab] = useState('welcome');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Mail className="h-5 w-5 mr-2" />
          Email Template Testing
        </CardTitle>
        <CardDescription>
          Preview and test email templates used in the system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-5 mb-6">
            <TabsTrigger value="welcome" className="flex items-center">
              <User className="h-4 w-4 mr-2" />
              Welcome
            </TabsTrigger>
            <TabsTrigger value="password-reset" className="flex items-center">
              <Key className="h-4 w-4 mr-2" />
              Password Reset
            </TabsTrigger>
            <TabsTrigger value="task-assignment" className="flex items-center">
              <CheckSquare className="h-4 w-4 mr-2" />
              Task Assignment
            </TabsTrigger>
            <TabsTrigger value="task-due" className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Task Due Soon
            </TabsTrigger>
            <TabsTrigger value="sop-approval" className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              SOP Approval
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="welcome">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Welcome Email</h3>
                <EmailTemplateTestForm 
                  templateName="Welcome Email"
                  defaultVariables={{
                    userName: "John Doe",
                    userEmail: "john.doe@example.com",
                    userRole: "Client Admin",
                    organization: "ACME Corporation"
                  }}
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Preview</h3>
                <WelcomeEmailPreview />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="password-reset">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Password Reset Email</h3>
                <EmailTemplateTestForm 
                  templateName="Password Reset"
                  defaultVariables={{
                    userName: "John Doe",
                    resetLink: "https://example.com/reset-password?token=123456789"
                  }}
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Preview</h3>
                <div className="border rounded-md p-4 bg-white">
                  <p className="text-sm text-gray-500">
                    Password reset emails are sent through Supabase Auth. The template can be customized in the Email Templates section of the Settings page.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="task-assignment">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Task Assignment Email</h3>
                <EmailTemplateTestForm 
                  templateName="Task Assignment"
                  defaultVariables={{
                    userName: "John Doe",
                    taskTitle: "Complete Project Proposal",
                    taskStatus: "Todo",
                    taskPriority: "High",
                    taskDueDate: "2025-05-15",
                    taskDescription: "We need to complete the project proposal for the client meeting next week.",
                    assignedBy: "Jane Smith",
                    clientName: "ACME Corporation",
                    actionUrl: "https://example.com/tasks/123"
                  }}
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Preview</h3>
                <NotificationEmailPreview 
                  notificationType="Task Assignment"
                  notificationTitle="You have been assigned to task 'Complete Project Proposal'"
                  notificationContent="We need to complete the project proposal for the client meeting next week."
                  userName="John Doe"
                  clientName="ACME Corporation"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="task-due">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Task Due Soon Email</h3>
                <EmailTemplateTestForm 
                  templateName="Task Due Soon"
                  defaultVariables={{
                    userName: "John Doe",
                    taskTitle: "Complete Project Proposal",
                    taskStatus: "In Progress",
                    taskPriority: "High",
                    taskDueDate: "2025-05-15",
                    taskDescription: "We need to complete the project proposal for the client meeting next week.",
                    clientName: "ACME Corporation",
                    actionUrl: "https://example.com/tasks/123"
                  }}
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Preview</h3>
                <NotificationEmailPreview 
                  notificationType="Task Due Soon"
                  notificationTitle="Task 'Complete Project Proposal' is due soon"
                  notificationContent="This task is due on May 15, 2025. Please complete it as soon as possible."
                  userName="John Doe"
                  clientName="ACME Corporation"
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="sop-approval">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">SOP Approval Email</h3>
                <EmailTemplateTestForm 
                  templateName="SOP Approval"
                  defaultVariables={{
                    userName: "John Doe",
                    sopTitle: "Customer Onboarding Process",
                    sopVersion: "2.1",
                    approvedBy: "Jane Smith",
                    approvalDate: "2025-05-10",
                    clientName: "ACME Corporation",
                    actionUrl: "https://example.com/sops/123"
                  }}
                />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900 mb-4">Preview</h3>
                <NotificationEmailPreview 
                  notificationType="SOP Approval"
                  notificationTitle="SOP 'Customer Onboarding Process' has been approved"
                  notificationContent="The SOP has been reviewed and approved. It is now available for use."
                  userName="John Doe"
                  clientName="ACME Corporation"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}