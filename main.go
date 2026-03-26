package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

func main() {
	rootCmd := &cobra.Command{
		Use:   "mycli",
		Short: "A simple CLI demo",
		Long:  "A demo CLI application built with Go and Cobra.",
	}

	// greet command
	var name string
	greetCmd := &cobra.Command{
		Use:   "greet",
		Short: "Greet someone",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("Hello, %s! Welcome to the CLI demo.\n", name)
		},
	}
	greetCmd.Flags().StringVarP(&name, "name", "n", "World", "name of the person to greet")

	// count command
	countCmd := &cobra.Command{
		Use:   "count [number]",
		Short: "Count from 1 to the given number",
		Args:  cobra.ExactArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			var n int
			if _, err := fmt.Sscanf(args[0], "%d", &n); err != nil || n <= 0 {
				fmt.Fprintln(os.Stderr, "Please provide a positive integer.")
				os.Exit(1)
			}
			for i := 1; i <= n; i++ {
				fmt.Println(i)
			}
		},
	}

	// reverse command
	reverseCmd := &cobra.Command{
		Use:   "reverse [text]",
		Short: "Reverse a string",
		Args:  cobra.MinimumNArgs(1),
		Run: func(cmd *cobra.Command, args []string) {
			text := strings.Join(args, " ")
			runes := []rune(text)
			for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
				runes[i], runes[j] = runes[j], runes[i]
			}
			fmt.Println(string(runes))
		},
	}

	rootCmd.AddCommand(greetCmd, countCmd, reverseCmd)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
