class Shopping
[
int customerno;
double x,y,tot;
public void asssign()
{
	customerno=75;
	x=500;
	y=1000;
}
public void assign(int s, double x,double y1)
{
	 customerno=s;
	 x=x1;
	 y=y1;
}
public void calc()
{
	tot=x+y;
}
public void display
{
	System.out.println("D-MART");
	System.out.println("BILL");
	SYstem.out.prinrtln("C.NO:"+customer no);
	System.out.println("Groceries:"+x);
	System.out.println("Clothes:"+y);
	System.out.println("Total:"+tot);
}
public static void main(String arg[])
{
	customerc=new customer();
	c.assign();
	c.calc();
	c.dispaly();
	//method overloading 
	c.assign(76,200,500);
	c.calc();
	c.display();
}
}