"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  PencilIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createUser, updateUser, toggleUserActive } from "@/actions/user.actions";

// ============================================================
// Types
// ============================================================

interface UserData {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: string;
  isActive: boolean;
  image: string | null;
  createdAt: Date | string;
}

interface UsersListProps {
  users: UserData[];
}

// ============================================================
// Constants
// ============================================================

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "SALES_EXEC", label: "Sales Executive" },
  { value: "EVENT_COORDINATOR", label: "Event Coordinator" },
  { value: "FINANCE", label: "Finance" },
  { value: "STAFF", label: "Staff" },
  { value: "BD_EXECUTIVE", label: "BD Executive" },
  { value: "BD_HEAD", label: "BD Head" },
  { value: "PROJECTS_EXEC", label: "Projects Executive" },
  { value: "PROJECTS_HEAD", label: "Projects Head" },
  { value: "OPERATIONS", label: "Operations" },
  { value: "LEGAL", label: "Legal" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES_EXEC: "Sales Exec",
  EVENT_COORDINATOR: "Coordinator",
  FINANCE: "Finance",
  STAFF: "Staff",
  BD_EXECUTIVE: "BD Exec",
  BD_HEAD: "BD Head",
  PROJECTS_EXEC: "Projects Exec",
  PROJECTS_HEAD: "Projects Head",
  OPERATIONS: "Operations",
  LEGAL: "Legal",
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "bg-red-100 text-red-700 border-red-200",
  ADMIN: "bg-purple-100 text-purple-700 border-purple-200",
  SALES_EXEC: "bg-blue-100 text-blue-700 border-blue-200",
  EVENT_COORDINATOR: "bg-amber-100 text-amber-700 border-amber-200",
  FINANCE: "bg-green-100 text-green-700 border-green-200",
  STAFF: "bg-zinc-100 text-zinc-700 border-zinc-200",
  BD_EXECUTIVE: "bg-cyan-100 text-cyan-700 border-cyan-200",
  BD_HEAD: "bg-teal-100 text-teal-700 border-teal-200",
  PROJECTS_EXEC: "bg-orange-100 text-orange-700 border-orange-200",
  PROJECTS_HEAD: "bg-rose-100 text-rose-700 border-rose-200",
  OPERATIONS: "bg-indigo-100 text-indigo-700 border-indigo-200",
  LEGAL: "bg-slate-100 text-slate-700 border-slate-200",
};

// ============================================================
// UsersList Component
// ============================================================

export function UsersList({ users }: UsersListProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserData | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Form state
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState("STAFF");
  const [phone, setPhone] = React.useState("");

  const isEditing = !!editingUser;

  // Filter users by search
  const filteredUsers = React.useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        ROLE_LABELS[u.role]?.toLowerCase().includes(q)
    );
  }, [users, search]);

  function openCreateDialog() {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("");
    setRole("STAFF");
    setPhone("");
    setDialogOpen(true);
  }

  function openEditDialog(user: UserData) {
    setEditingUser(user);
    setName(user.name || "");
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setPhone(user.phone || "");
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!isEditing) {
      if (!email.trim()) {
        toast.error("Email is required");
        return;
      }
      if (!password || password.length < 8) {
        toast.error("Password must be at least 8 characters");
        return;
      }
    }

    setIsPending(true);
    try {
      if (isEditing) {
        const result = await updateUser(editingUser!.id, {
          name: name.trim(),
          role,
          phone: phone.trim() || undefined,
        });
        if (result.success) {
          toast.success("User updated successfully");
          setDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      } else {
        const result = await createUser({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role,
          phone: phone.trim() || undefined,
        });
        if (result.success) {
          toast.success("User created successfully");
          setDialogOpen(false);
          router.refresh();
        } else {
          toast.error(result.error);
        }
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setIsPending(false);
    }
  }

  async function handleToggleActive(user: UserData) {
    try {
      const result = await toggleUserActive(user.id);
      if (result.success) {
        toast.success(
          user.isActive ? "User deactivated" : "User activated"
        );
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to update user status");
    }
  }

  function getInitials(name: string | null): string {
    if (!name) return "??";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={openCreateDialog}>
          <PlusIcon className="mr-2 size-4" />
          Add User
        </Button>
      </div>

      {/* Users Grid */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search
                ? "No users match your search."
                : "No team members yet. Add your first user to get started."}
            </p>
            {!search && (
              <Button className="mt-4" onClick={openCreateDialog}>
                <PlusIcon className="mr-2 size-4" />
                Add Your First User
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredUsers.map((user) => (
            <Card
              key={user.id}
              className={!user.isActive ? "opacity-60" : ""}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <Avatar className="size-10">
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">
                      {user.name || "Unnamed"}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`mt-1 text-[10px] ${ROLE_COLORS[user.role] || "bg-zinc-100 text-zinc-700 border-zinc-200"}`}
                    >
                      <ShieldIcon className="mr-1 size-2.5" />
                      {ROLE_LABELS[user.role] || user.role}
                    </Badge>
                  </div>
                  {user.isActive ? (
                    <Badge
                      variant="outline"
                      className="bg-green-100 text-green-700 border-green-200 text-[10px] shrink-0"
                    >
                      Active
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-gray-100 text-gray-500 border-gray-200 text-[10px] shrink-0"
                    >
                      Inactive
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <MailIcon className="size-3.5 text-zinc-400" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2 text-sm text-zinc-600">
                      <PhoneIcon className="size-3.5 text-zinc-400" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={user.isActive}
                      onCheckedChange={() => handleToggleActive(user)}
                    />
                    <span className="text-xs text-zinc-500">
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(user)}
                  >
                    <PencilIcon className="mr-1.5 size-3" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update user details and role."
                : "Create a new team member account."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-name">Full Name *</Label>
              <Input
                id="user-name"
                placeholder="e.g., Priya Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="user-email">Email *</Label>
                <Input
                  id="user-email"
                  type="email"
                  placeholder="e.g., priya@veloriagrand.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            )}

            {!isEditing && (
              <div className="space-y-2">
                <Label htmlFor="user-password">Password *</Label>
                <Input
                  id="user-password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="user-role">Role *</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger id="user-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input
                id="user-phone"
                type="tel"
                placeholder="e.g., +91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && (
                <Loader2Icon className="mr-2 size-4 animate-spin" />
              )}
              {isEditing ? "Update User" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
