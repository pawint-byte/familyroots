import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, X, Loader2, User, HelpCircle } from "lucide-react";
import { useUpload } from "@/hooks/use-upload";
import type { InsertFamilyMember } from "@shared/schema";

const memberFormSchema = z.object({
  isUnknown: z.boolean().default(false),
  unknownLabel: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  nickname: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  birthDate: z.string().optional(),
  birthPlace: z.string().optional(),
  deathDate: z.string().optional(),
  isLiving: z.boolean().default(true),
  photoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.isUnknown) return true;
  return data.firstName && data.firstName.length > 0;
}, {
  message: "First name is required for known members",
  path: ["firstName"],
});

type MemberFormValues = z.infer<typeof memberFormSchema>;

interface MemberFormProps {
  treeId: string;
  initialData?: Partial<MemberFormValues>;
  onSubmit: (data: InsertFamilyMember) => void;
  isLoading?: boolean;
}

export default function MemberForm({ treeId, initialData, onSubmit, isLoading }: MemberFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photoUrl || null);
  
  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      form.setValue("photoUrl", response.objectPath);
      setPhotoPreview(response.objectPath);
    },
  });

  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      isUnknown: (initialData as any)?.isUnknown ?? false,
      unknownLabel: (initialData as any)?.unknownLabel || "",
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      nickname: (initialData as any)?.nickname || "",
      email: (initialData as any)?.email || "",
      gender: initialData?.gender,
      birthDate: initialData?.birthDate || "",
      birthPlace: initialData?.birthPlace || "",
      deathDate: initialData?.deathDate || "",
      isLiving: initialData?.isLiving ?? true,
      photoUrl: initialData?.photoUrl || "",
      notes: initialData?.notes || "",
    },
  });

  const isLiving = form.watch("isLiving");
  const isUnknown = form.watch("isUnknown");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPhotoPreview(localPreview);

    await uploadFile(file);
  };

  const handleRemovePhoto = () => {
    form.setValue("photoUrl", "");
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (values: MemberFormValues) => {
    const data: InsertFamilyMember = {
      treeId,
      firstName: values.isUnknown ? (values.unknownLabel || "Unknown") : (values.firstName || "Unknown"),
      lastName: values.lastName || null,
      nickname: values.nickname || null,
      email: values.email || null,
      gender: values.gender || null,
      birthDate: values.birthDate || null,
      birthPlace: values.birthPlace || null,
      deathDate: values.isLiving ? null : (values.deathDate || null),
      isLiving: values.isLiving,
      photoUrl: values.photoUrl || null,
      notes: values.notes || null,
      isUnknown: values.isUnknown,
      unknownLabel: values.unknownLabel || null,
    };
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="isUnknown"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 bg-muted/30">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Unknown Member</FormLabel>
                  <p className="text-sm text-muted-foreground">
                    Create a placeholder for a family member with limited information
                  </p>
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-is-unknown"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {isUnknown ? (
          <FormField
            control={form.control}
            name="unknownLabel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Placeholder Label</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || undefined}>
                  <FormControl>
                    <SelectTrigger data-testid="select-unknown-label">
                      <SelectValue placeholder="Select placeholder type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Unknown Father">Unknown Father</SelectItem>
                    <SelectItem value="Unknown Mother">Unknown Mother</SelectItem>
                    <SelectItem value="Unknown Parent">Unknown Parent</SelectItem>
                    <SelectItem value="Unknown Sibling">Unknown Sibling</SelectItem>
                    <SelectItem value="Unknown Child">Unknown Child</SelectItem>
                    <SelectItem value="Unknown Spouse">Unknown Spouse</SelectItem>
                    <SelectItem value="Unknown Grandparent">Unknown Grandparent</SelectItem>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} data-testid="input-first-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nickname</FormLabel>
                <FormControl>
                  <Input placeholder="Johnny" {...field} data-testid="input-nickname" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <FormControl>
                  <SelectTrigger data-testid="select-gender">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="birthDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Birth Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-birth-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="birthPlace"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Birth Place</FormLabel>
                <FormControl>
                  <Input placeholder="City, Country" {...field} data-testid="input-birth-place" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="isLiving"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Living</FormLabel>
                <p className="text-sm text-muted-foreground">
                  Is this person still alive?
                </p>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-is-living"
                />
              </FormControl>
            </FormItem>
          )}
        />

        {!isLiving && (
          <FormField
            control={form.control}
            name="deathDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Death Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} data-testid="input-death-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="photoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Photo</FormLabel>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-border">
                  {photoPreview ? (
                    <AvatarImage src={photoPreview} alt="Preview" />
                  ) : null}
                  <AvatarFallback className="bg-muted">
                    <User className="h-8 w-8 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    data-testid="input-photo-file"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-photo"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photo
                      </>
                    )}
                  </Button>
                  {photoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemovePhoto}
                      className="text-destructive hover:text-destructive"
                      data-testid="button-remove-photo"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                <Input type="hidden" {...field} />
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Add any notes or stories about this person..."
                  className="resize-none"
                  rows={3}
                  {...field}
                  data-testid="textarea-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-submit-member">
          {isLoading ? "Saving..." : "Save Member"}
        </Button>
      </form>
    </Form>
  );
}
