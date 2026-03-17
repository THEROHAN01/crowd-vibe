"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@crowd-vibe/ui/components/button";
import { Input } from "@crowd-vibe/ui/components/input";
import { Label } from "@crowd-vibe/ui/components/label";
import { trpc, queryClient } from "@/utils/trpc";

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function CreateVenueForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const createVenue = useMutation(
    trpc.venue.create.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        onCreated();
      },
    })
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createVenue.mutate({ name, slug: slug || slugify(name), description: description || undefined });
      }}
      className="grid gap-4"
    >
      <div className="grid gap-2">
        <Label htmlFor="name">Venue Name</Label>
        <Input id="name" value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Blue Tokai Koramangala" required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">URL Slug</Label>
        <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="blue-tokai-koramangala" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="desc">Description (optional)</Label>
        <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A cozy cafe in Koramangala" />
      </div>
      <Button type="submit" disabled={createVenue.isPending}>
        {createVenue.isPending ? "Creating..." : "Create Venue"}
      </Button>
    </form>
  );
}
