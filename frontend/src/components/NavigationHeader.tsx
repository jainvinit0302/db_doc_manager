import React from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/auth/AuthProvider";
import {
  ArrowLeft,
  LogOut,
  User,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useLocation } from "react-router-dom";

interface NavigationHeaderProps {
  projectName: string;
  onBack?: () => void;
}

const NavigationHeader: React.FC<NavigationHeaderProps> = ({ 
  projectName,
  onBack 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("/create-project", { 
        state: {
          projectName: projectName,
          dslContent: location.state?.dslContent,
          uploadedFileName: location.state?.uploadedFileName,
          parsedData: location.state?.parsedData
        }
      });
    }
  };

  const handleLogout = () => logout();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="relative h-16 flex items-center">
        {/* Back Button */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2 z-30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2 px-3 transition-colors hover:text-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="Back to project"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Project</span>
          </Button>
        </div>

        {/* User Menu */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 z-30">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0 hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <Avatar>
                  <AvatarFallback>VJ</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">Vinit Jain</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    vinit.jain@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Center content area */}
        <div className="container flex items-center justify-center w-full pl-[160px] pr-[160px]">
          <div className="flex flex-col items-center justify-center text-center">
            <h1 className="text-lg font-semibold truncate max-w-[60vw]">
              {projectName || "Untitled Project"}
            </h1>
          </div>
        </div>
      </div>
    </header>
  );
};

export default NavigationHeader;
