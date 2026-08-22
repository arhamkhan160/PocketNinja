import React, { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import DataState from "../../components/ui/DataState";
import TransactionFilterBar, {
  EMPTY_FILTERS,
} from "./components/TransactionFilterBar";
import TransactionTable from "./components/TransactionTable";
import TransactionFormDialog from "./components/TransactionFormDialog";
import useFetch from "../../hooks/useFetch";
import useCategories from "../../hooks/useCategories";
import { getTransactions, deleteTransaction } from "../../api/finance";
import { errorMessage } from "../../utils/format";
