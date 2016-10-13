#include<iostream>
using namespace std;

bool pechati_parni_broevi_recursive(int min, int max)
{
	cout << min << " ";
	if (min == max)
		return true;
	else
		pechati_parni_broevi_recursive(min + 2, max);
}

void pechati_parni_broevi_iterative(int min, int max)
{
	for (int i = min; i <= max; i += 2)
		cout << i << " ";
}

int faktoriel_recursive(int n)
{
	if (n == 1)
		return 1;
	else
		return n * faktoriel_recursive(n - 1);

	/* пример
	5! = 5 * faktoriel_recursive(5-1)
	5! = 5 * faktoriel_recursive(5-1) * faktoriel_recursive(4-1)
	5! = 5 * faktoriel_recursive(5-1) * faktoriel_recursive(4-1) * faktoriel_recursive(3-1)
	5! = 5 * faktoriel_recursive(5-1) * faktoriel_recursive(4-1) * faktoriel_recursive(3-1) * faktoriel_recursive(2-1)
	-- faktoriel_recursive(2-1) враќа вредност 1 и оваа функција може да заврши
	5! = 5 * faktoriel_recursive(5-1) * faktoriel_recursive(4-1) * faktoriel_recursive(3-1) * 1
	5! = 5 * faktoriel_recursive(5-1) * faktoriel_recursive(4-1) * 2 * 1
	5! = 5 * faktoriel_recursive(5-1) * 3 * 2 * 1
	5! = 5 * 4 * 3 * 2 * 1
	5! = 120
	*/
}

int faktoriel_iterative(int n)
{
	int ret = 1;
	for (int i = 1; i <= n; i++)
		ret *= i;
	return ret;
}


int fibonachi_recursive(int n)
{
	if (n == 0)
		return 0;
	if (n == 1)
		return 1;

	return fibonachi_recursive(n - 1) + fibonachi_recursive(n - 2);
	/* пример

	fibonachi_recursive(5) = fibonachi_recursive(4) + fibonachi_recursive(3)
	fibonachi_recursive(4) = fibonachi_recursive(3) + fibonachi_recursive(2)
	fibonachi_recursive(3) = fibonachi_recursive(2) + fibonachi_recursive(1)
	fibonachi_recursive(2) = fibonachi_recursive(1) + fibonachi_recursive(0)
	-- fibonachi_recursive(1) и fibonachi_recursive(0) враќаат вредност 1 и 0 па затоа и fibonachi_recursive(2) може да заврши
	fibonachi_recursive(2) = 1 + 0 = 1
	fibonachi_recursive(3) = 1 + 1 = 2
	fibonachi_recursive(4) = 2 + 1 = 3
	fibonachi_recursive(5) = 3 + 2 = 5
	*/
}

int fibonachi_iterative(int n)
{
	int a = 0;
	int b = 1;
	int c;

	for (int i = 0; i < n - 1; i++)
	{
		c = a + b;
		a = b;
		b = c;
	}

	return c;
}

void pechati_niza(int niza[], int n)
{
	for (int i = 0; i < n; i++)
		cout << niza[i] << " ";
}

//	O(n^2)
void selection_sort(int niza[], int n)
{
	for (int i = 0; i < n; i++)
	{
		int min = i;
		for (int j = i + 1; j < n; j++)
			if (niza[j] < niza[min])
				min = j;
		if (min != i)
			swap(niza[min], niza[i]);
	}
}

//	O(n^2)
void insertion_sort(int niza[], int n)
{
	for (int i = 1; i < n; i++)
	{
		int element = niza[i];
		int j = i;
		while (j > 0 && niza[j - 1] > element)
		{
			niza[j] = niza[j - 1];
			j--;
		}
		niza[j] = element;
	}
}

// O(n^2)
void bubble_sort(int niza[], int n)
{
	for (int i = 0; i < (n - 1); i++)
		for (int j = 0; j < n - i - 1; j++)
			if (niza[j] > niza[j + 1])
				swap(niza[j], niza[j + 1]);
}

// O(n)
int linearno_prebaruvanje(int niza[], int n, int kluch)
{
	for (int i = 0; i < n; i++)
		if (niza[i] == kluch)
			return i;
	return -1;
}

// O(log n)
int binarno_prebaruvanje_recursive(int niza[], int n_max, int kluch, int n_min = 0)
{
	if (n_max < n_min)
		return -1;
	else
	{
		int sredina = (n_max + n_min) / 2;

		if (niza[sredina] > kluch)
			return binarno_prebaruvanje_recursive(niza, sredina - 1, kluch, n_min);
		else if (niza[sredina] < kluch)
			return binarno_prebaruvanje_recursive(niza, n_max, kluch, sredina + 1);
		else
			return sredina;
	}
}

// O(log n)
int binarno_prebaruvanje_iterative(int niza[], int n_max, int kluch)
{
	int n_min = 0;

	while (n_max >= n_min)
	{
		int sredina = (n_min + n_max) / 2;
		if (niza[sredina] == kluch)
			return sredina;
		else if (niza[sredina] < kluch)
			n_min = sredina + 1;
		else
			n_max = sredina - 1;
	}
	return -1;
}

int zbir_na_cifri(int n)
{
	int zbir = 0;

	while (n > 0)
	{
		zbir += n % 10;
		n /= 10;
	}

	return zbir;
}


void main()
{
	/*
	pechati_parni_broevi_recursive(4, 16);
	cout << endl;
	pechati_parni_broevi_iterative(4, 16);
	*/

	/*
	cout<<faktoriel_iterative(5);
	cout << endl;
	cout<<faktoriel_recursive(5);
	*/

	/*
	cout << fibonachi_iterative(5);
	cout << endl;
	cout << fibonachi_recursive(5);
	*/

	/*

	int niza[6] = { 75, 93, 13, 46, 38, 2 };
	// selection_sort(niza, 6);
	// insertion_sort(niza, 6);
	// bubble_sort(niza, 6);
	pechati_niza(niza, 6);

	*/

	cout << endl;
	system("pause");
}