"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CallInsightsDialogProps {
  content?: string | null;
  metadata?: any;
}

export function CallInsightsDialog({ content, metadata }: CallInsightsDialogProps) {
  if (!metadata || !metadata.isAiTranscription) return null;

  const {
    chapters,
    keyQuestions,
    issuesDiscussed,
    actionItems,
    transcription,
  } = metadata;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-300">
          <Sparkles className="h-4 w-4" />
          View Insights
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Call Insights
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6">
          <div className="space-y-8">
            {/* Summary */}
            <section className="space-y-3">
              <h3 className="text-lg font-semibold tracking-tight">Summary</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {content}
              </p>
            </section>

            {/* AI Tags */}
            {(keyQuestions || issuesDiscussed) && (
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {keyQuestions && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Key Questions</h4>
                    <p className="text-sm whitespace-pre-wrap">{keyQuestions}</p>
                  </div>
                )}
                {issuesDiscussed && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Issues Discussed</h4>
                    <p className="text-sm whitespace-pre-wrap">{issuesDiscussed}</p>
                  </div>
                )}
              </section>
            )}

            {/* Chapters */}
            {chapters && (
              <section className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Chapters</h4>
                <p className="text-sm whitespace-pre-wrap">{chapters}</p>
              </section>
            )}

            <Separator />

            {/* Transcription */}
            {Array.isArray(transcription) && transcription.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-lg font-semibold tracking-tight">Transcript</h3>
                <div className="space-y-4">
                  {transcription.map((t: any, i: number) => {
                    const isAgent = t.speaker?.toLowerCase() === "agent";
                    return (
                      <div
                        key={i}
                        className={`flex flex-col max-w-[85%] ${
                          isAgent ? "mr-auto" : "ml-auto items-end"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground mb-1 uppercase px-1">
                          {t.speaker}
                        </span>
                        <div
                          className={`rounded-2xl px-4 py-2.5 text-sm ${
                            isAgent
                              ? "bg-muted text-foreground rounded-tl-sm"
                              : "bg-primary text-primary-foreground rounded-tr-sm"
                          }`}
                        >
                          {t.utterance}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
